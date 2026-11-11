-- CONG_VIEC_53: Bán lẻ tại quầy (MODULE_14) – cửa hàng, quầy, ca thu ngân (CHUC_NANG_186; QUYTAC_NGHIEPVU_368, 369, 375; tài liệu 16).

INSERT INTO core.apps (code, name_vi, name_en, base_url, icon, sort_order) VALUES
    ('retail', 'Bán lẻ', 'Retail', '/retail', 'store', 55)
ON CONFLICT (code) DO NOTHING;

CREATE SCHEMA retail;

-- Cửa hàng bán lẻ: một chi nhánh loại cửa hàng (QUYTAC_NGHIEPVU_368).
CREATE TABLE retail.stores (
    id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id          uuid        NOT NULL REFERENCES core.companies(id),
    branch_id           uuid        NOT NULL UNIQUE REFERENCES core.branches(id),
    warehouse_id        uuid        NOT NULL REFERENCES inventory.warehouses(id),
    channel_id          uuid        NOT NULL REFERENCES catalog.sales_channels(id),
    cash_fund_id        uuid        NOT NULL REFERENCES finance.funds(id),
    bank_fund_id        uuid        REFERENCES finance.funds(id),
    vietqr_bank_bin     text        CHECK (vietqr_bank_bin ~ '^[0-9]{6}$'),
    vietqr_account_name text        CHECK (vietqr_account_name ~ '^[A-Z0-9 ]{1,50}$'),
    return_days         integer     NOT NULL DEFAULT 7 CHECK (return_days BETWEEN 0 AND 90),
    receipt_footer      text        CHECK (char_length(receipt_footer) <= 300),
    status              text        NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
    created_at          timestamptz NOT NULL DEFAULT now(),
    created_by          uuid        NOT NULL REFERENCES core.users(id),
    updated_at          timestamptz NOT NULL DEFAULT now(),
    version             integer     NOT NULL DEFAULT 1,
    CHECK (bank_fund_id IS NULL OR (vietqr_bank_bin IS NOT NULL AND vietqr_account_name IS NOT NULL))
);
CREATE INDEX stores_company_idx ON retail.stores (company_id);

-- Quầy thu ngân của cửa hàng.
CREATE TABLE retail.registers (
    id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id          uuid        NOT NULL REFERENCES core.companies(id),
    store_id            uuid        NOT NULL REFERENCES retail.stores(id),
    code                text        NOT NULL CHECK (code ~ '^[A-Z0-9_]{1,20}$'),
    name                text        NOT NULL CHECK (char_length(name) BETWEEN 1 AND 100),
    status              text        NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
    created_at          timestamptz NOT NULL DEFAULT now(),
    updated_at          timestamptz NOT NULL DEFAULT now(),
    version             integer     NOT NULL DEFAULT 1,
    UNIQUE (store_id, code)
);

-- Ca thu ngân (QUYTAC_NGHIEPVU_369, 375). Tiền làm tròn theo đơn vị tiền tệ của công ty.
CREATE TABLE retail.shifts (
    id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id          uuid        NOT NULL REFERENCES core.companies(id),
    store_id            uuid        NOT NULL REFERENCES retail.stores(id),
    register_id         uuid        NOT NULL REFERENCES retail.registers(id),
    cashier_id          uuid        NOT NULL REFERENCES core.users(id),
    opened_at           timestamptz NOT NULL DEFAULT now(),
    opening_cash        numeric(18, 4) NOT NULL CHECK (opening_cash >= 0),
    opening_note        text        CHECK (char_length(opening_note) BETWEEN 1 AND 500),
    status              text        NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'closed')),
    closed_at           timestamptz,
    closed_by           uuid        REFERENCES core.users(id),
    expected_cash       numeric(18, 4),
    counted_cash        numeric(18, 4) CHECK (counted_cash >= 0),
    difference          numeric(18, 4),
    difference_reason   text        CHECK (char_length(difference_reason) BETWEEN 1 AND 500),
    version             integer     NOT NULL DEFAULT 1,
    CHECK (status = 'open' OR (closed_at IS NOT NULL AND closed_by IS NOT NULL AND expected_cash IS NOT NULL AND counted_cash IS NOT NULL AND difference IS NOT NULL)),
    CHECK (difference IS NULL OR difference = 0 OR difference_reason IS NOT NULL)
);
CREATE UNIQUE INDEX shifts_open_register_idx ON retail.shifts (register_id) WHERE status = 'open';
CREATE UNIQUE INDEX shifts_open_cashier_idx ON retail.shifts (cashier_id) WHERE status = 'open';
CREATE INDEX shifts_store_idx ON retail.shifts (store_id, opened_at DESC);
