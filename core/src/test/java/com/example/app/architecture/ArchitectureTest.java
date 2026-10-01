package com.example.app.architecture;

import static com.tngtech.archunit.lang.syntax.ArchRuleDefinition.classes;
import static com.tngtech.archunit.lang.syntax.ArchRuleDefinition.noClasses;
import static com.tngtech.archunit.library.dependencies.SlicesRuleDefinition.slices;
import static org.assertj.core.api.Assertions.assertThat;

import com.tngtech.archunit.core.domain.JavaClass;
import com.tngtech.archunit.core.domain.JavaClasses;
import com.tngtech.archunit.core.importer.ClassFileImporter;
import com.tngtech.archunit.core.importer.ImportOption;
import com.tngtech.archunit.lang.ArchCondition;
import com.tngtech.archunit.lang.ArchRule;
import com.tngtech.archunit.lang.ConditionEvents;
import com.tngtech.archunit.lang.EvaluationResult;
import com.tngtech.archunit.lang.SimpleConditionEvent;
import com.tngtech.archunit.library.freeze.FreezingArchRule;
import java.io.IOException;
import java.io.UncheckedIOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.regex.Pattern;
import org.junit.jupiter.api.Test;

/**
 * The nightly ring report (ADR-015).
 *
 * <p>This is an instrument, not a gate. Surefire excludes it by default, so
 * {@code mvn clean verify} never runs it; {@code mvn -Parchitecture verify} does, and the
 * scheduled workflow runs the same profile scoped to this module. A violation makes that
 * run red and blocks no pull request.
 *
 * <p>Rules are numbered as ADR-015 numbers them. <strong>Rule 7 is deliberately
 * absent</strong> — that {@code core} carries no logging API belongs to ADR-016, and is
 * enforced by the build instead.
 *
 * <p>Every rule starts green. When the tree acquires violations that are accepted as debt,
 * declare that rule {@link RingRule#frozen} and baseline it into {@code core/archunit_store/}
 * (see {@code archunit.properties}); the report then shows only what is new, and each fix
 * shrinks the store.
 *
 * <p><strong>The store matches on text.</strong> A frozen rule's description is its key, so
 * changing an {@code as(...)} string orphans that rule's baseline; and each stored violation
 * is matched by its own rendered text, so rewording what a condition emits makes every
 * frozen violation read as new.
 *
 * <p>Everything here reads <em>bytecode</em>. An import kept only for a Javadoc
 * {@code {@link}} leaves no trace in the constant pool, so a green report is not proof that
 * the rings are honoured in prose as well.
 *
 * @see #everyRuleCanFail() the reason the rules are parameterised by base package
 */
class ArchitectureTest {

    /**
     * The root every module's packages hang from, not {@code core}'s alone. Only
     * {@code core} is on this module's classpath, which is what makes it usable as the
     * import root here.
     */
    private static final String BASE_PACKAGE = "com.example.app";

    /**
     * A mirror of the three rings, deliberately full of violations, used by
     * {@link #everyRuleCanFail()}. Excluded from the real run because that import filters
     * {@code target/test-classes}, which is where these compile to.
     */
    private static final String FIXTURES = BASE_PACKAGE + ".architecture.fixtures";

    /** Relative to the module basedir, which is {@code core/} under Surefire. */
    private static final Path REPORT = Path.of("target", "architecture-report.md");

    /**
     * Opening a resource whose lifecycle {@code core} would then own. Deliberately narrow
     * (ADR-004): {@code InputStream}, {@code IOException} and {@code StandardCharsets} are a
     * streaming port's own vocabulary. This rule is about opening a resource, never about
     * carrying one an adapter opened.
     */
    private static final String RESOURCE_OPENING_TYPE_PATTERN =
            "java\\.nio\\.file\\..*"
                    + "|java\\.net\\.http\\..*"
                    + "|java\\.io\\.File"
                    + "|java\\.io\\.File(Input|Output)Stream"
                    + "|java\\.io\\.File(Reader|Writer)"
                    + "|java\\.net\\.Socket"
                    + "|java\\.net\\.URL";

    /**
     * Static factories that read the host clock or invent an identifier, keyed by owner and
     * name only so an overload cannot slip past on its parameter list.
     */
    private static final Set<String> NON_DETERMINISTIC_CALLS = Set.of(
            "java.time.Instant#now",
            "java.time.LocalDate#now",
            "java.time.LocalDateTime#now",
            "java.time.LocalTime#now",
            "java.time.OffsetDateTime#now",
            "java.time.ZonedDateTime#now",
            "java.time.Year#now",
            "java.time.YearMonth#now",
            "java.lang.System#currentTimeMillis",
            "java.lang.System#nanoTime",
            "java.util.UUID#randomUUID",
            "java.lang.Math#random",
            "java.util.concurrent.ThreadLocalRandom#current");

    /**
     * Randomness sources {@code core} has no reason to name at all, so the <em>type</em> is
     * out and not merely its constructor: an injected {@code Random} field is the same
     * crossing and is not a constructor call.
     */
    private static final Set<String> RANDOMNESS_TYPES =
            Set.of("java.util.Random", "java.security.SecureRandom");

    /**
     * How rule 5 recognises a Port failure. It walks superclass <em>names</em> rather than
     * asking {@code isAssignableTo(Throwable.class)}, because {@code archunit.properties}
     * resolves only {@code com.example.app} and stubs the rest: {@code RuntimeException}'s
     * own ancestry is therefore unresolved and assignability to {@code Throwable} reads
     * false. A raw superclass name is in the constant pool and is known even for a stub.
     */
    private static final Pattern JDK_THROWABLE =
            Pattern.compile("java\\..*(Exception|Error)|java\\.lang\\.Throwable");

    /** A rule plus whether the tree already violates it. */
    private record RingRule(ArchRule rule, boolean frozen) {

        static RingRule green(ArchRule rule) {
            return new RingRule(rule, false);
        }

        static RingRule frozen(ArchRule rule) {
            return new RingRule(rule, true);
        }

        String description() {
            return rule.getDescription();
        }

        ArchRule applied() {
            return frozen ? FreezingArchRule.freeze(rule) : rule;
        }
    }

    @Test
    void theRingsHold() {
        // src/main only: every invariant here is stated about shipped code. DoNotIncludeTests
        // filters by path (.../target/test-classes/...), which is where core's tests and the
        // fixtures compile to.
        JavaClasses core = new ClassFileImporter()
                .withImportOption(new ImportOption.DoNotIncludeTests())
                .importPackages(BASE_PACKAGE);

        Map<String, EvaluationResult> results = new LinkedHashMap<>();
        for (RingRule ringRule : ringRules(BASE_PACKAGE)) {
            results.put(ringRule.description(), ringRule.applied().evaluate(core));
        }

        String report = render(results);
        writeReport(report);
        // The only stdout write in core's test tree, and deliberate: a report exists to be
        // read, and this is what a local `mvn -Parchitecture verify` shows.
        System.out.println(report);

        List<String> broken = results.entrySet().stream()
                .filter(entry -> entry.getValue().hasViolation())
                .map(entry -> "  - " + entry.getKey() + " (" + newViolations(entry.getValue()) + " new)")
                .toList();

        assertThat(broken)
                .as(
                        "%d architecture rule(s) report violations that are not in "
                                + "core/archunit_store/. The full report is above and in %s.%n%s%n"
                                + "Fix the code, or — if the violation is accepted debt — freeze the "
                                + "rule deliberately and commit the store (see archunit.properties).",
                        broken.size(), REPORT, String.join(System.lineSeparator(), broken))
                .isEmpty();
    }

    /**
     * Proves every rule is falsifiable, by running the same definitions against a mirrored
     * ring structure planted with violations.
     *
     * <p>A green rule and a broken rule are indistinguishable from their report: both say
     * zero. A rule that cannot fail is worse than an absent one; this is that principle
     * applied to the instrument.
     *
     * <p>The fixtures exercise every <em>clause</em>, not merely every rule: each alternative
     * of {@link #RESOURCE_OPENING_TYPE_PATTERN} and each member of
     * {@link #NON_DETERMINISTIC_CALLS} and {@link #RANDOMNESS_TYPES} is reached, and both a
     * direct call and a method reference are planted, since those are different bytecode.
     *
     * <p>Nothing here is frozen — the fixtures must never reach {@code core/archunit_store/}.
     */
    @Test
    void everyRuleCanFail() {
        JavaClasses planted = new ClassFileImporter().importPackages(FIXTURES);

        assertThat(planted)
                .as("the planted fixtures must be on the test classpath for this to prove anything")
                .isNotEmpty();

        for (RingRule ringRule : ringRules(FIXTURES)) {
            assertThat(ringRule.rule().evaluate(planted).hasViolation())
                    .as(
                            "%s reported no violation against fixtures planted to break it. "
                                    + "Either the fixture stopped violating it or the rule is broken "
                                    + "— and a rule that cannot fail is worse than no rule (ADR-015).",
                            ringRule.description())
                    .isTrue();
        }
    }

    /**
     * The seven rules, parameterised by the package they judge so that
     * {@link #everyRuleCanFail()} can point them at fixtures. Descriptions are fixed rather
     * than derived from {@code base}, because they are the freeze store's keys.
     */
    private static List<RingRule> ringRules(String base) {
        String domain = base + ".domain";
        String flows = base + ".flows";
        String ports = base + ".ports";

        List<RingRule> rules = new ArrayList<>();

        rules.add(RingRule.green(noClasses()
                .that()
                .resideInAPackage(domain + "..")
                .should()
                .dependOnClassesThat()
                .resideInAnyPackage(flows + "..", ports + "..")
                .as("Rule 1: domain depends on neither flows nor ports")));

        rules.add(RingRule.green(noClasses()
                .that()
                .resideInAPackage(ports + "..")
                .should()
                .dependOnClassesThat()
                .resideInAPackage(flows + "..")
                .as("Rule 2: ports does not depend on flows")));

        // JavaClass.getName() is already the fully qualified name.
        rules.add(RingRule.green(noClasses()
                .that()
                .resideInAPackage(base + "..")
                .should()
                .dependOnClassesThat()
                .haveNameMatching(RESOURCE_OPENING_TYPE_PATTERN)
                .as("Rule 3: core opens no file, socket or HTTP connection")));

        // 4 — one rule per ring so a failure names the ring. A class in a ring root is in no
        // slice, so it takes part in no cycle this can see; rule 6 covers that side.
        rules.add(cycleRule(domain, "domain"));
        rules.add(cycleRule(flows, "flows"));
        rules.add(cycleRule(ports, "ports"));

        rules.add(RingRule.green(classes()
                .that()
                .resideInAPackage(ports + "..")
                .and()
                .areTopLevelClasses()
                .should(bePortShaped())
                .as("Rule 5: ports holds only a Port, a Port DTO or a Port failure")));

        // No trailing "..", so this matches the ring root exactly and not its subdomains.
        rules.add(RingRule.green(noClasses()
                .that()
                .areTopLevelClasses()
                .should()
                .resideInAnyPackage(domain, flows, ports)
                .as("Rule 6: every class in a ring lives in a subdomain package")));

        rules.add(RingRule.green(noClasses()
                .that()
                .resideInAPackage(base + "..")
                .should(readTheHostDirectly())
                .as("Rule 8: core produces no non-deterministic value directly")));

        return rules;
    }

    private static RingRule cycleRule(String ringPackage, String ringName) {
        return RingRule.green(slices()
                .matching(ringPackage + ".(*)..")
                .should()
                .beFreeOfCycles()
                .as("Rule 4: " + ringName + " subdomains are free of cycles"));
    }

    /**
     * Rule 5's condition, written by hand so the failure message speaks {@code CONTEXT.md}'s
     * vocabulary rather than Java's. "Port" names the outbound interface alone; a record is
     * a Port DTO, and an exception is a Port failure.
     */
    private static ArchCondition<JavaClass> bePortShaped() {
        return new ArchCondition<>("be a Port, a Port DTO or a Port failure") {
            @Override
            public void check(JavaClass item, ConditionEvents events) {
                boolean satisfied = item.isInterface() || item.isRecord() || isPortFailure(item);
                events.add(new SimpleConditionEvent(
                        item,
                        satisfied,
                        item.getName()
                                + " is none of the three things the ports ring holds: it is not an"
                                + " outbound interface (Port), not a record (Port DTO) and not an"
                                + " exception (Port failure)"));
            }
        };
    }

    /** See {@link #JDK_THROWABLE} for why this walks names instead of asking assignability. */
    private static boolean isPortFailure(JavaClass item) {
        for (JavaClass ancestor = item.getRawSuperclass().orElse(null);
                ancestor != null;
                ancestor = ancestor.getRawSuperclass().orElse(null)) {
            if (JDK_THROWABLE.matcher(ancestor.getName()).matches()) {
                return true;
            }
        }
        return false;
    }

    /**
     * Rule 8's condition.
     *
     * <p>It walks <em>accesses</em> rather than method calls, because a method reference is
     * not a call in bytecode: {@code Instant::now} would otherwise be invisible, and that is
     * exactly the idiom {@code adapters/jvm} uses to supply the value. Randomness is matched
     * on the whole dependency graph rather than on constructor calls, so an injected field
     * counts too.
     *
     * <p><strong>Events are emitted as satisfied, not violated, and that is deliberate.</strong>
     * {@code noClasses().should(c)} wraps {@code c} in {@code never(c)}, which inverts every
     * event: a class that <em>does</em> read the host satisfies this condition, and the
     * inversion is what turns satisfying it into the failure. Emitting a violated event here
     * inverts to satisfied and the rule silently passes — {@link #everyRuleCanFail()} exists
     * to catch exactly that.
     */
    private static ArchCondition<JavaClass> readTheHostDirectly() {
        return new ArchCondition<>("read the host clock or invent an identifier directly") {
            @Override
            public void check(JavaClass item, ConditionEvents events) {
                item.getAccessesFromSelf().forEach(access -> {
                    String target = access.getTargetOwner().getName() + "#" + access.getName();
                    if (NON_DETERMINISTIC_CALLS.contains(target)) {
                        events.add(SimpleConditionEvent.satisfied(
                                access,
                                target
                                        + " reached from "
                                        + access.getOriginOwner().getName()
                                        + " — a static call site cannot be substituted in a test."
                                        + " Take the value from a port instead (ADR-002, ADR-015). "
                                        + access.getSourceCodeLocation()));
                    }
                });
                item.getDirectDependenciesFromSelf().forEach(dependency -> {
                    String target = dependency.getTargetClass().getName();
                    if (RANDOMNESS_TYPES.contains(target)) {
                        events.add(SimpleConditionEvent.satisfied(
                                dependency,
                                target
                                        + " named by "
                                        + item.getName()
                                        + " — randomness belongs behind a port (ADR-002, ADR-015). "
                                        + dependency.getDescription()));
                    }
                });
            }
        };
    }

    private static int newViolations(EvaluationResult result) {
        return result.hasViolation() ? result.getFailureReport().getDetails().size() : 0;
    }

    private static String render(Map<String, EvaluationResult> results) {
        StringBuilder out = new StringBuilder();
        out.append("## Architecture report — core's rings (ADR-015)")
                .append(System.lineSeparator())
                .append(System.lineSeparator())
                .append("Counts are violations **not** already in `core/archunit_store/`.")
                .append(System.lineSeparator())
                .append(System.lineSeparator())
                .append("| Rule | New violations |")
                .append(System.lineSeparator())
                .append("| --- | --- |")
                .append(System.lineSeparator());

        results.forEach((description, result) -> out.append("| ")
                .append(description)
                .append(" | ")
                .append(newViolations(result))
                .append(" |")
                .append(System.lineSeparator()));

        results.forEach((description, result) -> {
            if (!result.hasViolation()) {
                return;
            }
            out.append(System.lineSeparator())
                    .append("### ")
                    .append(description)
                    .append(System.lineSeparator())
                    .append(System.lineSeparator());
            result.getFailureReport()
                    .getDetails()
                    .forEach(detail ->
                            out.append("- ").append(detail).append(System.lineSeparator()));
        });

        return out.toString();
    }

    private static void writeReport(String report) {
        try {
            Files.createDirectories(REPORT.getParent());
            Files.writeString(REPORT, report, StandardCharsets.UTF_8);
        } catch (IOException e) {
            throw new UncheckedIOException("could not write " + REPORT, e);
        }
    }
}
