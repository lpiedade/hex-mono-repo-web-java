-- Operational schema baseline (ADR-021).
--
-- One stream, one history table. Add V2__..., V3__... here as the schema grows;
-- never edit a migration that has shipped.

CREATE TABLE item (
    id          uuid         PRIMARY KEY,
    name        varchar(120) NOT NULL,
    description varchar(1000),
    created_at  timestamptz  NOT NULL,
    updated_at  timestamptz  NOT NULL,
    CONSTRAINT item_name_unique UNIQUE (name),
    CONSTRAINT item_updated_after_created CHECK (updated_at >= created_at)
);
