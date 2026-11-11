-- CONG_VIEC_49 L3: bảng tin cộng đồng mở, đánh giá đã mua hàng, bình luận, thích, báo cáo, kiểm duyệt (CHUC_NANG_174; QUYTAC_NGHIEPVU_333 đến 335).

-- Bài đăng: người mua (member), đánh giá gắn dòng đơn đã giao (review), bài của VComm (official).
CREATE TABLE marketplace.posts (
    id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id          uuid        NOT NULL REFERENCES core.companies(id),
    author_user_id      uuid        NOT NULL REFERENCES core.users(id),
    kind                text        NOT NULL CHECK (kind IN ('member', 'review', 'official')),
    content             text        NOT NULL CHECK (char_length(content) BETWEEN 1 AND 2000),
    rating              integer     CHECK (rating BETWEEN 1 AND 5),
    order_line_id       uuid        UNIQUE REFERENCES sales.order_lines(id),
    reviewed_product_id uuid        REFERENCES catalog.products(id),
    status              text        NOT NULL DEFAULT 'visible' CHECK (status IN ('visible', 'auto_hidden', 'hidden', 'deleted')),
    hidden_reason       text        CHECK (hidden_reason IS NULL OR char_length(hidden_reason) BETWEEN 1 AND 500),
    is_pinned           boolean     NOT NULL DEFAULT false,
    like_count          integer     NOT NULL DEFAULT 0 CHECK (like_count >= 0),
    comment_count       integer     NOT NULL DEFAULT 0 CHECK (comment_count >= 0),
    created_at          timestamptz NOT NULL DEFAULT now(),
    updated_at          timestamptz NOT NULL DEFAULT now(),
    version             integer     NOT NULL DEFAULT 1,
    CHECK ((kind = 'review') = (rating IS NOT NULL AND order_line_id IS NOT NULL AND reviewed_product_id IS NOT NULL)),
    CHECK (NOT is_pinned OR kind = 'official'),
    CHECK ((status = 'hidden') = (hidden_reason IS NOT NULL))
);
CREATE INDEX posts_feed_idx ON marketplace.posts (company_id, is_pinned DESC, created_at DESC) WHERE status = 'visible';
CREATE INDEX posts_author_idx ON marketplace.posts (author_user_id, created_at DESC);
CREATE INDEX posts_reviewed_product_idx ON marketplace.posts (reviewed_product_id) WHERE kind = 'review' AND status = 'visible';

CREATE TABLE marketplace.post_images (
    id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    uploader_id   uuid        NOT NULL REFERENCES core.users(id),
    post_id       uuid        REFERENCES marketplace.posts(id),
    sort_order    integer     NOT NULL DEFAULT 0,
    storage_key   text        NOT NULL,
    content_type  text        NOT NULL CHECK (content_type IN ('image/jpeg', 'image/png')),
    size_bytes    integer     NOT NULL CHECK (size_bytes BETWEEN 1 AND 5242880),
    created_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX post_images_post_idx ON marketplace.post_images (post_id, sort_order);
CREATE INDEX post_images_pending_idx ON marketplace.post_images (uploader_id, created_at) WHERE post_id IS NULL;

CREATE TABLE marketplace.post_products (
    post_id     uuid    NOT NULL REFERENCES marketplace.posts(id),
    product_id  uuid    NOT NULL REFERENCES catalog.products(id),
    sort_order  integer NOT NULL,
    PRIMARY KEY (post_id, product_id)
);
CREATE INDEX post_products_product_idx ON marketplace.post_products (product_id);

CREATE TABLE marketplace.post_comments (
    id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    post_id         uuid        NOT NULL REFERENCES marketplace.posts(id),
    author_user_id  uuid        NOT NULL REFERENCES core.users(id),
    content         text        NOT NULL CHECK (char_length(content) BETWEEN 1 AND 1000),
    status          text        NOT NULL DEFAULT 'visible' CHECK (status IN ('visible', 'auto_hidden', 'hidden', 'deleted')),
    hidden_reason   text        CHECK (hidden_reason IS NULL OR char_length(hidden_reason) BETWEEN 1 AND 500),
    created_at      timestamptz NOT NULL DEFAULT now(),
    version         integer     NOT NULL DEFAULT 1,
    CHECK ((status = 'hidden') = (hidden_reason IS NOT NULL))
);
CREATE INDEX post_comments_post_idx ON marketplace.post_comments (post_id, created_at);
CREATE INDEX post_comments_author_idx ON marketplace.post_comments (author_user_id, created_at DESC);

CREATE TABLE marketplace.post_likes (
    post_id     uuid        NOT NULL REFERENCES marketplace.posts(id),
    user_id     uuid        NOT NULL REFERENCES core.users(id),
    created_at  timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (post_id, user_id)
);

-- Báo cáo vi phạm: mỗi người một lần mỗi nội dung (QUYTAC_NGHIEPVU_335).
CREATE TABLE marketplace.content_reports (
    id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    post_id       uuid        REFERENCES marketplace.posts(id),
    comment_id    uuid        REFERENCES marketplace.post_comments(id),
    reporter_id   uuid        NOT NULL REFERENCES core.users(id),
    reason        text        NOT NULL CHECK (reason IN ('spam', 'scam', 'abuse', 'prohibited', 'other')),
    description   text        CHECK (description IS NULL OR char_length(description) <= 500),
    status        text        NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'resolved', 'dismissed')),
    handled_by    uuid        REFERENCES core.users(id),
    handled_at    timestamptz,
    created_at    timestamptz NOT NULL DEFAULT now(),
    CHECK ((post_id IS NULL) <> (comment_id IS NULL))
);
CREATE UNIQUE INDEX content_reports_post_idx ON marketplace.content_reports (post_id, reporter_id) WHERE post_id IS NOT NULL;
CREATE UNIQUE INDEX content_reports_comment_idx ON marketplace.content_reports (comment_id, reporter_id) WHERE comment_id IS NOT NULL;
CREATE INDEX content_reports_pending_idx ON marketplace.content_reports (status, created_at) WHERE status = 'pending';

-- Khóa đăng bài, bình luận của tài khoản; until NULL là vĩnh viễn; lifted_at khi mở khóa.
CREATE TABLE marketplace.community_bans (
    id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     uuid        NOT NULL REFERENCES core.users(id),
    until       timestamptz,
    reason      text        NOT NULL CHECK (char_length(reason) BETWEEN 1 AND 500),
    banned_by   uuid        NOT NULL REFERENCES core.users(id),
    created_at  timestamptz NOT NULL DEFAULT now(),
    lifted_by   uuid        REFERENCES core.users(id),
    lifted_at   timestamptz
);
CREATE INDEX community_bans_user_idx ON marketplace.community_bans (user_id, created_at DESC);

-- Công tắc đăng bài, bình luận của người mua; từ cấm (QUYTAC_NGHIEPVU_334, 335).
CREATE TABLE marketplace.community_settings (
    company_id      uuid        PRIMARY KEY REFERENCES core.companies(id),
    posting_enabled boolean     NOT NULL DEFAULT true,
    comments_enabled boolean    NOT NULL DEFAULT true,
    banned_words    text[]      NOT NULL DEFAULT '{}' CHECK (cardinality(banned_words) <= 500),
    updated_by      uuid        NOT NULL REFERENCES core.users(id),
    updated_at      timestamptz NOT NULL DEFAULT now(),
    version         integer     NOT NULL DEFAULT 1
);

INSERT INTO core.permissions (code, app_code, name_vi, name_en, is_sensitive) VALUES
    ('marketplace.community.manage', 'crm', 'Kiểm duyệt bảng tin cộng đồng, đăng bài VComm', 'Moderate the community feed, post as VComm', true)
ON CONFLICT (code) DO NOTHING;
