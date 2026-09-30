# The database and the role the application connects with.
#
# Schema creation is NOT here: Flyway owns the schema and runs on API start
# (ADR-008, ADR-021). This file only produces the empty database and its
# owner - the same starting point compose.yaml gives a developer.

resource "postgresql_role" "app" {
  name     = local.db_role
  login    = true
  password = data.aws_ssm_parameter.db_app_password.value

  create_database = false
  create_role     = false
  superuser       = false
  inherit         = true
}

resource "postgresql_database" "app" {
  name              = local.db_name
  owner             = postgresql_role.app.name
  encoding          = "UTF8"
  lc_collate        = "en_US.UTF-8"
  lc_ctype          = "en_US.UTF-8"
  template          = "template0"
  connection_limit  = -1
  allow_connections = true
}

# Owning the database is not owning its public schema: on PostgreSQL 15 and
# later, public is owned by the bootstrap superuser and grants CREATE to
# nobody. Without this the first Flyway migration fails with "permission
# denied for schema public".
resource "postgresql_grant" "app_public_schema" {
  database    = postgresql_database.app.name
  role        = postgresql_role.app.name
  schema      = "public"
  object_type = "schema"
  privileges  = ["CREATE", "USAGE"]
}
