-- Migration: Stripe → CloudPayments
-- Adds CloudPayments fields to users table
-- Replaces Stripe payment tables with CloudPayments equivalents
-- Removes Visionary slot system

-- 1. Add new CloudPayments fields to users table
ALTER TABLE users ADD cloudpayments_subscription_id text;
ALTER TABLE users ADD cloudpayments_token text;

-- 2. Create new lookup table for CloudPayments subscription ID
CREATE TABLE IF NOT EXISTS users_by_cloudpayments_subscription_id (
    cloudpayments_subscription_id text,
    user_id bigint,
    PRIMARY KEY (cloudpayments_subscription_id, user_id)
);

-- 3. Create new payments table (replaces old checkout_session_id-based table)
CREATE TABLE IF NOT EXISTS payments_v2 (
    payment_id text PRIMARY KEY,
    user_id bigint,
    cloudpayments_transaction_id bigint,
    cloudpayments_subscription_id text,
    product_type text,
    amount_cents int,
    currency text,
    status text,
    is_gift boolean,
    gift_code text,
    created_at timestamp,
    completed_at timestamp,
    version int
);

-- 4. Create new lookup table for payments by CloudPayments transaction ID
CREATE TABLE IF NOT EXISTS payments_by_transaction (
    cloudpayments_transaction_id bigint PRIMARY KEY,
    payment_id text
);

-- 5. Create new lookup table for payments by user
CREATE TABLE IF NOT EXISTS payments_by_user_v2 (
    user_id bigint,
    created_at timestamp,
    payment_id text,
    PRIMARY KEY (user_id, created_at)
) WITH CLUSTERING ORDER BY (created_at DESC);

-- 6. Update gift_codes table — add new fields
ALTER TABLE gift_codes ADD cloudpayments_transaction_id bigint;
ALTER TABLE gift_codes ADD payment_id text;

-- 7. Create new gift codes lookup by transaction ID
CREATE TABLE IF NOT EXISTS gift_codes_by_transaction (
    cloudpayments_transaction_id bigint,
    code text,
    PRIMARY KEY (cloudpayments_transaction_id, code)
);

-- Note: Old tables are NOT dropped in this migration to allow rollback.
-- They can be dropped in a future cleanup migration:
--   DROP TABLE IF EXISTS users_by_stripe_customer_id;
--   DROP TABLE IF EXISTS users_by_stripe_subscription_id;
--   DROP TABLE IF EXISTS payments;
--   DROP TABLE IF EXISTS payments_by_payment_intent;
--   DROP TABLE IF EXISTS payments_by_subscription;
--   DROP TABLE IF EXISTS payments_by_user;
--   DROP TABLE IF EXISTS gift_codes_by_payment_intent;
--   DROP TABLE IF EXISTS visionary_slots;
--
-- Old user columns can also be dropped later:
--   ALTER TABLE users DROP stripe_subscription_id;
--   ALTER TABLE users DROP stripe_customer_id;
--   ALTER TABLE users DROP premium_lifetime_sequence;
--
-- Old gift_codes columns:
--   ALTER TABLE gift_codes DROP stripe_payment_intent_id;
--   ALTER TABLE gift_codes DROP visionary_sequence_number;
--   ALTER TABLE gift_codes DROP checkout_session_id;
