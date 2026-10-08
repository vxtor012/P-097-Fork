CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TYPE user_role      AS ENUM ('buyer','seller','warehouse','admin');
CREATE TYPE quote_status   AS ENUM ('pending','approved','rejected','expired');
CREATE TYPE discount_type  AS ENUM ('fixed','percent');
CREATE TYPE battery_option AS ENUM ('buy','rent');
CREATE TYPE lead_status    AS ENUM ('new','contacted','quoted','closed_won','closed_lost');

CREATE TABLE IF NOT EXISTS dealers (
    id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name       VARCHAR(255) NOT NULL,
    province   VARCHAR(100) NOT NULL,
    address    TEXT,
    phone      VARCHAR(20),
    lat        FLOAT,
    lng        FLOAT,
    is_active  BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS users (
    id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email      VARCHAR(255) UNIQUE NOT NULL,
    name       VARCHAR(255) NOT NULL,
    hashed_pw  VARCHAR(255) NOT NULL,
    role       user_role DEFAULT 'buyer',
    dealer_id  UUID REFERENCES dealers(id) ON DELETE SET NULL,
    is_active  BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS vehicle_prices (
    id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    model          VARCHAR(50)  NOT NULL,
    version        VARCHAR(100) NOT NULL,
    color          VARCHAR(100) NOT NULL,
    color_hex      VARCHAR(7)   NOT NULL,
    price          BIGINT       NOT NULL,
    price_version  VARCHAR(50)  NOT NULL,
    effective_from TIMESTAMP    NOT NULL,
    effective_to   TIMESTAMP,
    image_url      VARCHAR(500),
    created_at     TIMESTAMP DEFAULT NOW()
);


CREATE TABLE IF NOT EXISTS battery_prices (
    id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    model      VARCHAR(50) NOT NULL UNIQUE,
    buy_price  BIGINT NOT NULL,
    rent_price BIGINT NOT NULL,
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS accessories (
    id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    code              VARCHAR(50) UNIQUE NOT NULL,
    name              VARCHAR(255) NOT NULL,
    price             BIGINT NOT NULL,
    compatible_models TEXT[] DEFAULT '{}',
    is_active         BOOLEAN DEFAULT TRUE
);

CREATE TABLE IF NOT EXISTS rolling_costs (
    id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    province          VARCHAR(100) NOT NULL UNIQUE,
    registration_rate FLOAT  NOT NULL,
    road_fee          BIGINT NOT NULL,
    inspection_fee    BIGINT NOT NULL,
    insurance_rate    FLOAT  NOT NULL,
    plate_fee         BIGINT NOT NULL,
    updated_at        TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS promotions (
    id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name           VARCHAR(255) NOT NULL,
    description    TEXT,
    model          VARCHAR(50) DEFAULT 'ALL',
    province       VARCHAR(100),
    dealer_id      UUID REFERENCES dealers(id) ON DELETE SET NULL,
    discount_type  discount_type NOT NULL,
    discount_value BIGINT NOT NULL,
    start_date     TIMESTAMP NOT NULL,
    end_date       TIMESTAMP NOT NULL,
    conditions     JSONB DEFAULT '{}',
    is_active      BOOLEAN DEFAULT TRUE,
    usage_count    INT DEFAULT 0,
    created_by     UUID REFERENCES users(id),
    created_at     TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS leads (
    id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    session_id    VARCHAR(100) NOT NULL,
    name          VARCHAR(255),
    phone         VARCHAR(20),
    province      VARCHAR(100),
    interested_in VARCHAR(255),
    budget        BIGINT,
    note          TEXT,
    status        lead_status DEFAULT 'new',
    dealer_id     UUID REFERENCES dealers(id),
    assigned_to   UUID REFERENCES users(id),
    created_at    TIMESTAMP DEFAULT NOW(),
    updated_at    TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS quotes (
    id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    session_id     VARCHAR(100) NOT NULL,
    lead_id        UUID REFERENCES leads(id),
    buyer_name     VARCHAR(255),
    buyer_phone    VARCHAR(20),
    model          VARCHAR(50),
    version        VARCHAR(100),
    color          VARCHAR(100),
    battery        battery_option,
    province       VARCHAR(100),
    accessories    TEXT[] DEFAULT '{}',
    price_snapshot JSONB NOT NULL,
    price_version  VARCHAR(50) NOT NULL,
    final_price    BIGINT NOT NULL,
    status         quote_status DEFAULT 'pending',
    seller_id      UUID REFERENCES users(id),
    seller_note    TEXT,
    pdf_url        VARCHAR(500),
    created_at     TIMESTAMP DEFAULT NOW(),
    reviewed_at    TIMESTAMP,
    expires_at     TIMESTAMP DEFAULT (NOW() + INTERVAL '7 days')
);

CREATE TABLE IF NOT EXISTS inventory (
    id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    dealer_id    UUID NOT NULL REFERENCES dealers(id),
    model        VARCHAR(50)  NOT NULL,
    version      VARCHAR(100) NOT NULL,
    color        VARCHAR(100) NOT NULL,
    color_hex    VARCHAR(7),
    quantity     INT DEFAULT 0,
    est_delivery VARCHAR(100),
    updated_by   UUID REFERENCES users(id),
    updated_at   TIMESTAMP DEFAULT NOW(),
    UNIQUE(dealer_id, model, version, color)
);
