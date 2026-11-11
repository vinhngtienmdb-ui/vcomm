-- CONG_VIEC_26 L0: thiết lập hoa hồng từng sản phẩm, cài đặt hoa hồng chung (QUYTAC_NGHIEPVU_200, 204, 205).
-- Một cách tính cho cả sản phẩm: phần trăm trên tiền hàng chưa thuế sau khuyến mãi, hoặc số tiền cố định trên mỗi đơn vị cơ sở.
CREATE TABLE marketplace.product_commissions (
    product_id        uuid          PRIMARY KEY REFERENCES catalog.products(id),
    company_id        uuid          NOT NULL REFERENCES core.companies(id),
    calculation       text          NOT NULL CHECK (calculation IN ('percent', 'fixed')),
    referral          numeric(18,4) NOT NULL CHECK (referral >= 0),
    staff             numeric(18,4) NOT NULL CHECK (staff >= 0),
    team_head         numeric(18,4) NOT NULL CHECK (team_head >= 0),
    regional_director numeric(18,4) NOT NULL CHECK (regional_director >= 0),
    director          numeric(18,4) NOT NULL CHECK (director >= 0),
    updated_by        uuid          NOT NULL REFERENCES core.users(id),
    updated_at        timestamptz   NOT NULL DEFAULT now(),
    version           integer       NOT NULL DEFAULT 1,
    CHECK (calculation = 'fixed' OR referral + staff + team_head + regional_director + director <= 100)
);

CREATE TABLE marketplace.commission_settings (
    company_id         uuid          PRIMARY KEY REFERENCES core.companies(id),
    tax_threshold      numeric(18,4) NOT NULL DEFAULT 5000000 CHECK (tax_threshold >= 0),
    tax_rate           numeric(7,4)  NOT NULL DEFAULT 10 CHECK (tax_rate BETWEEN 0 AND 100),
    minimum_withdrawal numeric(18,4) NOT NULL DEFAULT 100000 CHECK (minimum_withdrawal > 0),
    updated_by         uuid          REFERENCES core.users(id),
    updated_at         timestamptz   NOT NULL DEFAULT now(),
    version            integer       NOT NULL DEFAULT 1
);
