package com.example.app.domain.item;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.time.Instant;
import java.util.UUID;
import org.junit.jupiter.api.Test;

class ItemTest {

    private static final UUID ID = UUID.fromString("00000000-0000-0000-0000-000000000001");
    private static final Instant T0 = Instant.parse("2026-01-01T00:00:00Z");
    private static final Instant T1 = Instant.parse("2026-01-02T00:00:00Z");

    @Test
    void createTrimsTheNameAndStampsBothInstants() {
        Item item = Item.create(ID, "  Widget  ", "  A thing  ", T0);

        assertThat(item.name()).isEqualTo("Widget");
        assertThat(item.description()).isEqualTo("A thing");
        assertThat(item.createdAt()).isEqualTo(T0);
        assertThat(item.updatedAt()).isEqualTo(T0);
    }

    @Test
    void aBlankDescriptionIsNoDescription() {
        assertThat(Item.create(ID, "Widget", "   ", T0).description()).isNull();
        assertThat(Item.create(ID, "Widget", null, T0).description()).isNull();
    }

    @Test
    void reviseKeepsIdentityAndCreationTime() {
        Item revised = Item.create(ID, "Widget", null, T0).revise("Gadget", "New", T1);

        assertThat(revised.id()).isEqualTo(ID);
        assertThat(revised.name()).isEqualTo("Gadget");
        assertThat(revised.createdAt()).isEqualTo(T0);
        assertThat(revised.updatedAt()).isEqualTo(T1);
    }

    @Test
    void refusesABlankName() {
        assertThatThrownBy(() -> Item.create(ID, "  ", null, T0))
                .isInstanceOf(InvalidItemException.class)
                .extracting(e -> ((InvalidItemException) e).problem())
                .isEqualTo(ItemProblems.ITEM_INVALID);
        assertThatThrownBy(() -> Item.create(ID, null, null, T0)).isInstanceOf(InvalidItemException.class);
    }

    @Test
    void refusesValuesOverTheirLimits() {
        String name = "n".repeat(Item.NAME_MAX_LENGTH + 1);
        String description = "d".repeat(Item.DESCRIPTION_MAX_LENGTH + 1);

        assertThatThrownBy(() -> Item.create(ID, name, null, T0)).isInstanceOf(InvalidItemException.class);
        assertThatThrownBy(() -> Item.create(ID, "Widget", description, T0))
                .isInstanceOf(InvalidItemException.class);
    }

    @Test
    void acceptsValuesExactlyAtTheirLimits() {
        Item item = Item.create(
                ID, "n".repeat(Item.NAME_MAX_LENGTH), "d".repeat(Item.DESCRIPTION_MAX_LENGTH), T0);

        assertThat(item.name()).hasSize(Item.NAME_MAX_LENGTH);
        assertThat(item.description()).hasSize(Item.DESCRIPTION_MAX_LENGTH);
    }

    @Test
    void refusesAnUpdateBeforeCreation() {
        assertThatThrownBy(() -> new Item(ID, "Widget", null, T1, T0)).isInstanceOf(InvalidItemException.class);
    }
}
