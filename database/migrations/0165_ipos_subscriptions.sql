-- CONG_VIEC_74 L0: iPOS (MODULE_17), schema `ipos`: gói, cách thu phí theo cửa hàng, thuê bao điểm bán
-- (QUYTAC_NGHIEPVU_593 đến 598; THAY_DOI_39; tài liệu 16). Khóa ngoại chỉ trỏ vào `core`, `affiliate`.

CREATE SCHEMA IF NOT EXISTS ipos;

-- Gói iPOS do công ty vận hành sàn khai báo (QUYTAC_NGHIEPVU_594).
CREATE TABLE ipos.plans (
    id                  uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id          uuid          NOT NULL REFERENCES core.companies(id),
    code                text          NOT NULL CHECK (code ~ '^[A-Z0-9-]{1,20}$'),
    name                text          NOT NULL CHECK (length(name) BETWEEN 1 AND 100),
    monthly_price       numeric(18,4) NOT NULL CHECK (monthly_price >= 0),
    -- Thuế suất giá trị gia tăng của phí phần mềm (phần trăm).
    tax_percent         numeric(5,2)  NOT NULL CHECK (tax_percent IN (0, 5, 8, 10)),
    max_registers       integer       NOT NULL CHECK (max_registers BETWEEN 1 AND 50),
    -- Trống: không giới hạn số mặt hàng.
    max_items           integer       CHECK (max_items IS NULL OR max_items BETWEEN 100 AND 100000),
    trial_days          integer       NOT NULL DEFAULT 0 CHECK (trial_days BETWEEN 0 AND 90),
    status              text          NOT NULL DEFAULT 'selling' CHECK (status IN ('selling', 'retired')),
    created_by          uuid          NOT NULL REFERENCES core.users(id),
    created_at          timestamptz   NOT NULL DEFAULT now(),
    updated_by          uuid          NOT NULL REFERENCES core.users(id),
    updated_at          timestamptz   NOT NULL DEFAULT now(),
    version             integer       NOT NULL DEFAULT 1,
    UNIQUE (company_id, code)
);

-- Cách thu phí thuê bao của mỗi cửa hàng, áp mọi thuê bao của cửa hàng (QUYTAC_NGHIEPVU_598).
CREATE TABLE ipos.merchant_billing (
    merchant_id         uuid          PRIMARY KEY REFERENCES affiliate.merchants(id),
    method              text          NOT NULL CHECK (method IN ('collection_deduction', 'settlement_deduction', 'vietqr', 'free')),
    -- Miễn phí: trống là không thời hạn.
    free_until          date,
    free_reason         text          CHECK (free_reason IS NULL OR length(free_reason) BETWEEN 1 AND 500),
    updated_by          uuid          NOT NULL REFERENCES core.users(id),
    updated_at          timestamptz   NOT NULL DEFAULT now(),
    version             integer       NOT NULL DEFAULT 1,
    CHECK ((method = 'free') = (free_reason IS NOT NULL)),
    CHECK (method = 'free' OR free_until IS NULL)
);

-- Thuê bao theo điểm bán (QUYTAC_NGHIEPVU_595 đến 597). Mỗi điểm bán tối đa một thuê bao chưa hủy.
CREATE TABLE ipos.subscriptions (
    id                      uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
    merchant_id             uuid          NOT NULL REFERENCES affiliate.merchants(id),
    outlet_id               uuid          NOT NULL REFERENCES affiliate.outlets(id),
    plan_id                 uuid          NOT NULL REFERENCES ipos.plans(id),
    period_months           integer       NOT NULL CHECK (period_months IN (1, 6, 12)),
    starts_on               date          NOT NULL,
    -- Trống: không dùng thử. Ngày hết hạn = ngày hết dùng thử (hoặc ngày bắt đầu) + kỳ; gia hạn cộng một kỳ.
    trial_ends_on           date          CHECK (trial_ends_on IS NULL OR trial_ends_on >= starts_on),
    ends_on                 date          NOT NULL CHECK (ends_on > starts_on),
    custom_monthly_price    numeric(18,4) CHECK (custom_monthly_price IS NULL OR custom_monthly_price >= 0),
    custom_max_registers    integer       CHECK (custom_max_registers IS NULL OR custom_max_registers BETWEEN 1 AND 50),
    status                  text          NOT NULL CHECK (status IN ('trial', 'active', 'overdue', 'locked', 'cancelled')),
    -- Tạm khóa tay (quản trị) khác tạm khóa do quá hạn: mở khóa tay chỉ áp cho khóa tay.
    locked_manually         boolean       NOT NULL DEFAULT false,
    status_reason           text          CHECK (status_reason IS NULL OR length(status_reason) BETWEEN 1 AND 500),
    cancelled_at            timestamptz,
    created_by              uuid          NOT NULL REFERENCES core.users(id),
    created_at              timestamptz   NOT NULL DEFAULT now(),
    updated_by              uuid          NOT NULL REFERENCES core.users(id),
    updated_at              timestamptz   NOT NULL DEFAULT now(),
    version                 integer       NOT NULL DEFAULT 1,
    CHECK ((status = 'cancelled') = (cancelled_at IS NOT NULL)),
    CHECK (locked_manually <= (status = 'locked'))
);
CREATE UNIQUE INDEX subscriptions_outlet_open_idx ON ipos.subscriptions (outlet_id) WHERE status <> 'cancelled';
CREATE INDEX subscriptions_merchant_idx ON ipos.subscriptions (merchant_id);
CREATE INDEX subscriptions_status_ends_idx ON ipos.subscriptions (status, ends_on);

-- Điểm bán phải thuộc đúng cửa hàng của thuê bao (QUYTAC_NGHIEPVU_593): kiểm bằng trigger vì `affiliate.outlets` không có khóa (id, merchant_id).
CREATE FUNCTION ipos.check_outlet_merchant() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM affiliate.outlets o WHERE o.id = NEW.outlet_id AND o.merchant_id = NEW.merchant_id) THEN
        RAISE EXCEPTION 'Điểm bán % không thuộc cửa hàng %', NEW.outlet_id, NEW.merchant_id USING ERRCODE = '23514';
    END IF;
    RETURN NEW;
END $$;
CREATE TRIGGER subscriptions_outlet_merchant BEFORE INSERT OR UPDATE OF outlet_id, merchant_id ON ipos.subscriptions
    FOR EACH ROW EXECUTE FUNCTION ipos.check_outlet_merchant();
