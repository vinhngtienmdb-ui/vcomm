-- CONG_VIEC_51 L0: chương trình điểm theo giai đoạn, bảng hạng thành viên (QUYTAC_NGHIEPVU_345, 351). Schema loyalty của MODULE_11.
CREATE SCHEMA IF NOT EXISTS loyalty;

-- Giai đoạn chương trình điểm của công ty vận hành sàn; không chồng lấn (một chương trình cho cả sàn).
CREATE TABLE loyalty.program_phases (
    id                  uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id          uuid          NOT NULL REFERENCES core.companies(id),
    starts_on           date          NOT NULL,
    ends_on             date          CHECK (ends_on IS NULL OR ends_on >= starts_on),
    earn_percent        numeric(7,4)  NOT NULL CHECK (earn_percent BETWEEN 0 AND 100),
    point_value         numeric(18,4) NOT NULL CHECK (point_value > 0),
    redeem_max_percent  numeric(7,4)  NOT NULL CHECK (redeem_max_percent BETWEEN 0 AND 100),
    redeem_min_points   integer       NOT NULL CHECK (redeem_min_points >= 1),
    validity_months     integer       NOT NULL DEFAULT 12 CHECK (validity_months BETWEEN 1 AND 60),
    order_cap_points    integer       CHECK (order_cap_points IS NULL OR order_cap_points > 0),
    monthly_cap_points  integer       CHECK (monthly_cap_points IS NULL OR monthly_cap_points > 0),
    created_by          uuid          NOT NULL REFERENCES core.users(id),
    created_at          timestamptz   NOT NULL DEFAULT now(),
    updated_by          uuid          NOT NULL REFERENCES core.users(id),
    updated_at          timestamptz   NOT NULL DEFAULT now(),
    version             integer       NOT NULL DEFAULT 0,
    EXCLUDE USING gist (daterange(starts_on, ends_on, '[]') WITH &&)
);

-- Bảng hạng: hạng thứ tự 1 là hạng thấp nhất, mức chi tiêu 0; hệ số nhân điểm tích.
CREATE TABLE loyalty.tiers (
    id                uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
    sort_order        integer       NOT NULL UNIQUE CHECK (sort_order >= 1),
    name_vi           text          NOT NULL CHECK (length(name_vi) BETWEEN 1 AND 50),
    name_en           text          NOT NULL CHECK (length(name_en) BETWEEN 1 AND 50),
    min_annual_spend  numeric(18,4) NOT NULL CHECK (min_annual_spend >= 0),
    multiplier        numeric(6,3)  NOT NULL CHECK (multiplier BETWEEN 1 AND 5),
    updated_by        uuid          REFERENCES core.users(id),
    updated_at        timestamptz   NOT NULL DEFAULT now()
);
INSERT INTO loyalty.tiers (sort_order, name_vi, name_en, min_annual_spend, multiplier) VALUES
    (1, 'Thành viên', 'Member', 0, 1),
    (2, 'Bạc', 'Silver', 5000000, 1.2),
    (3, 'Vàng', 'Gold', 20000000, 1.5),
    (4, 'Kim cương', 'Diamond', 50000000, 2);
