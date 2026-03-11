-- ============================================================================
-- UDTs
-- ============================================================================

CREATE TYPE IF NOT EXISTS floodilka.custom_status (
    text text,
    emoji_id bigint,
    emoji_name text,
    emoji_animated boolean,
    expires_at timestamp
);

CREATE TYPE IF NOT EXISTS floodilka.guild_folder (
    folder_id int,
    name text,
    color int,
    guild_ids list<bigint>
);

CREATE TYPE IF NOT EXISTS floodilka.mute_config (
    end_time timestamp,
    selected_time_window int
);

CREATE TYPE IF NOT EXISTS floodilka.channel_override (
    collapsed boolean,
    message_notifications int,
    muted boolean,
    mute_config frozen<mute_config>
);

CREATE TYPE IF NOT EXISTS floodilka.permission_overwrite (
    type int,
    allow_ bigint,
    deny_ bigint
);

CREATE TYPE IF NOT EXISTS floodilka.message_attachment (
    attachment_id bigint,
    filename text,
    size bigint,
    title text,
    description text,
    width int,
    height int,
    duration int,
    content_type text,
    content_hash text,
    placeholder text,
    flags int,
    nsfw boolean
);

CREATE TYPE IF NOT EXISTS floodilka.message_embed_author (
    name text,
    url text,
    icon_url text
);

CREATE TYPE IF NOT EXISTS floodilka.message_embed_provider (
    name text,
    url text
);

CREATE TYPE IF NOT EXISTS floodilka.message_embed_footer (
    text text,
    icon_url text
);

CREATE TYPE IF NOT EXISTS floodilka.message_embed_media (
    url text,
    width int,
    height int,
    duration int,
    description text,
    content_type text,
    content_hash text,
    placeholder text,
    flags int
);

CREATE TYPE IF NOT EXISTS floodilka.message_embed_field (
    name text,
    value text,
    inline boolean
);

CREATE TYPE IF NOT EXISTS floodilka.message_embed (
    type text,
    title text,
    description text,
    url text,
    timestamp timestamp,
    color int,
    author frozen<message_embed_author>,
    provider frozen<message_embed_provider>,
    thumbnail frozen<message_embed_media>,
    image frozen<message_embed_media>,
    video frozen<message_embed_media>,
    footer frozen<message_embed_footer>,
    fields frozen<list<message_embed_field>>,
    nsfw boolean
);

CREATE TYPE IF NOT EXISTS floodilka.message_sticker_item (
    sticker_id bigint,
    name text,
    format_type int
);

CREATE TYPE IF NOT EXISTS floodilka.message_reference (
    channel_id bigint,
    message_id bigint,
    guild_id bigint,
    type int
);

CREATE TYPE IF NOT EXISTS floodilka.message_call (
    participant_ids set<bigint>,
    ended_timestamp timestamp
);

CREATE TYPE IF NOT EXISTS floodilka.message_snapshot (
    content text,
    timestamp timestamp,
    edited_timestamp timestamp,
    mention_users set<bigint>,
    mention_roles set<bigint>,
    mention_channels set<bigint>,
    attachments frozen<list<message_attachment>>,
    embeds frozen<list<message_embed>>,
    sticker_items frozen<list<message_sticker_item>>,
    type int,
    flags int
);

CREATE TYPE IF NOT EXISTS floodilka.iar_message_context (
    message_id bigint,
    channel_id bigint,
    author_id bigint,
    author_username text,
    author_avatar_hash text,
    content text,
    timestamp timestamp,
    edited_timestamp timestamp,
    type int,
    flags int,
    mention_everyone boolean,
    mention_users set<bigint>,
    mention_roles set<bigint>,
    mention_channels set<bigint>,
    attachments frozen<list<message_attachment>>,
    embeds frozen<list<message_embed>>,
    sticker_items frozen<list<message_sticker_item>>
);

-- ============================================================================
-- Users
-- ============================================================================

CREATE TABLE IF NOT EXISTS floodilka.users (
    user_id bigint,
    username text,
    global_name text,
    bot boolean,
    system boolean,
    email text,
    email_verified boolean,
    email_bounced boolean,
    phone text,
    password_hash text,
    password_last_changed_at timestamp,
    totp_secret text,
    authenticator_types set<int>,
    avatar_hash text,
    avatar_color int,
    banner_hash text,
    banner_color int,
    bio text,
    date_of_birth date,
    locale text,
    flags bigint,
    premium_type int,
    premium_since timestamp,
    premium_until timestamp,
    premium_will_cancel boolean,
    premium_billing_cycle text,
    cloudpayments_subscription_id text,
    cloudpayments_token text,
    has_ever_purchased boolean,
    suspicious_activity_flags int,
    terms_agreed_at timestamp,
    privacy_agreed_at timestamp,
    last_active_at timestamp,
    last_active_ip text,
    temp_banned_until timestamp,
    pending_bulk_message_deletion_at timestamp,
    pending_bulk_message_deletion_channel_count int,
    pending_bulk_message_deletion_message_count int,
    pending_deletion_at timestamp,
    deletion_reason_code int,
    deletion_public_reason text,
    deletion_audit_log_reason text,
    acls set<text>,
    first_refund_at timestamp,
    gift_inventory_server_seq int,
    gift_inventory_client_seq int,
    premium_onboarding_dismissed_at timestamp,
    version int,
    PRIMARY KEY ((user_id))
);

CREATE TABLE IF NOT EXISTS floodilka.users_by_email (
    email_lower text,
    user_id bigint,
    PRIMARY KEY ((email_lower), user_id)
);

CREATE TABLE IF NOT EXISTS floodilka.users_by_phone (
    phone text,
    user_id bigint,
    PRIMARY KEY ((phone), user_id)
);

CREATE TABLE IF NOT EXISTS floodilka.users_by_username (
    username text,
    user_id bigint,
    PRIMARY KEY (username, user_id)
) WITH CLUSTERING ORDER BY (user_id ASC);

CREATE TABLE IF NOT EXISTS floodilka.users_by_cloudpayments_subscription_id (
    cloudpayments_subscription_id text,
    user_id bigint,
    PRIMARY KEY ((cloudpayments_subscription_id), user_id)
);

CREATE TABLE IF NOT EXISTS floodilka.users_pending_deletion (
    deletion_date date,
    pending_deletion_at timestamp,
    user_id bigint,
    deletion_reason_code int,
    PRIMARY KEY ((deletion_date), pending_deletion_at, user_id)
) WITH CLUSTERING ORDER BY (pending_deletion_at ASC, user_id ASC);

CREATE TABLE IF NOT EXISTS floodilka.user_dm_history (
    user_id bigint,
    channel_id bigint,
    PRIMARY KEY ((user_id), channel_id)
);

CREATE TABLE IF NOT EXISTS floodilka.user_settings (
    user_id bigint,
    locale text,
    theme text,
    status text,
    status_resets_at timestamp,
    status_resets_to text,
    custom_status frozen<custom_status>,
    developer_mode boolean,
    message_display_compact boolean,
    animate_emoji boolean,
    animate_stickers int,
    gif_auto_play boolean,
    render_embeds boolean,
    render_reactions boolean,
    render_spoilers int,
    inline_attachment_media boolean,
    inline_embed_media boolean,
    explicit_content_filter int,
    friend_source_flags int,
    incoming_call_flags int,
    group_dm_add_permission_flags int,
    default_guilds_restricted boolean,
    restricted_guilds set<bigint>,
    guild_positions list<bigint>,
    guild_folders frozen<list<guild_folder>>,
    afk_timeout int,
    time_format int,
    version int,
    PRIMARY KEY ((user_id))
);

CREATE TABLE IF NOT EXISTS floodilka.user_guild_settings (
    user_id bigint,
    guild_id bigint,
    message_notifications int,
    muted boolean,
    mute_config frozen<mute_config>,
    mobile_push boolean,
    suppress_everyone boolean,
    suppress_roles boolean,
    hide_muted_channels boolean,
    channel_overrides frozen<map<bigint, channel_override>>,
    version int,
    PRIMARY KEY ((user_id), guild_id)
);

CREATE TABLE IF NOT EXISTS floodilka.user_contact_change_logs (
    user_id bigint,
    event_id timeuuid,
    field text,
    old_value text,
    new_value text,
    reason text,
    actor_user_id bigint,
    event_at timestamp,
    PRIMARY KEY ((user_id), event_id)
) WITH CLUSTERING ORDER BY (event_id DESC);

CREATE TABLE IF NOT EXISTS floodilka.relationships (
    source_user_id bigint,
    target_user_id bigint,
    type int,
    nickname text,
    since timestamp,
    version int,
    PRIMARY KEY ((source_user_id), target_user_id, type)
);

CREATE TABLE IF NOT EXISTS floodilka.notes (
    source_user_id bigint,
    target_user_id bigint,
    note text,
    version int,
    PRIMARY KEY ((source_user_id), target_user_id)
);

CREATE TABLE IF NOT EXISTS floodilka.user_harvests (
    user_id bigint,
    harvest_id bigint,
    requested_at timestamp,
    started_at timestamp,
    completed_at timestamp,
    failed_at timestamp,
    storage_key text,
    file_size bigint,
    progress_percent int,
    progress_step text,
    error_message text,
    download_url_expires_at timestamp,
    PRIMARY KEY (user_id, harvest_id)
) WITH CLUSTERING ORDER BY (harvest_id DESC);

-- ============================================================================
-- Authentication & Authorization
-- ============================================================================

CREATE TABLE IF NOT EXISTS floodilka.auth_sessions (
    session_id_hash blob,
    user_id bigint,
    created_at timestamp,
    approx_last_used_at timestamp,
    client_ip text,
    client_user_agent text,
    client_is_desktop boolean,
    version int,
    PRIMARY KEY ((session_id_hash))
);

CREATE TABLE IF NOT EXISTS floodilka.auth_sessions_by_user_id (
    user_id bigint,
    session_id_hash blob,
    PRIMARY KEY ((user_id), session_id_hash)
);

CREATE TABLE IF NOT EXISTS floodilka.mfa_backup_codes (
    user_id bigint,
    code text,
    consumed boolean,
    PRIMARY KEY ((user_id), code)
);

CREATE TABLE IF NOT EXISTS floodilka.webauthn_credentials (
    user_id bigint,
    credential_id text,
    public_key blob,
    counter bigint,
    transports set<text>,
    name text,
    created_at timestamp,
    last_used_at timestamp,
    version int,
    PRIMARY KEY (user_id, credential_id)
);

CREATE TABLE IF NOT EXISTS floodilka.webauthn_credential_lookup (
    credential_id text PRIMARY KEY,
    user_id bigint
);

CREATE TABLE IF NOT EXISTS floodilka.email_verification_tokens (
    token_ text,
    user_id bigint,
    email text,
    PRIMARY KEY ((token_), user_id)
) WITH default_time_to_live = 86400;

CREATE TABLE IF NOT EXISTS floodilka.password_reset_tokens (
    token_ text,
    user_id bigint,
    email text,
    PRIMARY KEY ((token_), user_id)
) WITH default_time_to_live = 3600;


CREATE TABLE IF NOT EXISTS floodilka.email_revert_tokens (
    token_ text,
    user_id bigint,
    email text,
    PRIMARY KEY ((token_), user_id)
) WITH default_time_to_live = 172800;

CREATE TABLE IF NOT EXISTS floodilka.mfa_tickets (
    ticket text,
    user_id bigint,
    PRIMARY KEY ((ticket), user_id)
) WITH default_time_to_live = 300;

CREATE TABLE IF NOT EXISTS floodilka.phone_tokens (
    token_ text PRIMARY KEY,
    phone text,
    user_id bigint
);


CREATE TABLE IF NOT EXISTS floodilka.email_change_tickets (
    ticket text,
    user_id bigint,
    require_original boolean,
    original_email text,
    original_verified boolean,
    original_proof text,
    original_code text,
    original_code_sent_at timestamp,
    original_code_expires_at timestamp,
    new_email text,
    new_code text,
    new_code_sent_at timestamp,
    new_code_expires_at timestamp,
    status text,
    created_at timestamp,
    updated_at timestamp,
    PRIMARY KEY ((ticket))
);

CREATE TABLE IF NOT EXISTS floodilka.email_change_tokens (
    token_ text,
    user_id bigint,
    new_email text,
    expires_at timestamp,
    created_at timestamp,
    PRIMARY KEY ((token_))
);

CREATE TABLE IF NOT EXISTS floodilka.banned_emails (
    email_lower text PRIMARY KEY
);

CREATE TABLE IF NOT EXISTS floodilka.banned_phones (
    phone text PRIMARY KEY
);

CREATE TABLE IF NOT EXISTS floodilka.banned_ips (
    ip text PRIMARY KEY
);

-- ============================================================================
-- Guilds
-- ============================================================================

CREATE TABLE IF NOT EXISTS floodilka.guilds (
    guild_id bigint,
    owner_id bigint,
    name text,
    vanity_url_code text,
    icon_hash text,
    banner_hash text,
    banner_width int,
    banner_height int,
    splash_hash text,
    splash_width int,
    splash_height int,
    splash_card_alignment int,
    embed_splash_hash text,
    embed_splash_width int,
    embed_splash_height int,
    features set<text>,
    verification_level int,
    mfa_level int,
    nsfw_level int,
    explicit_content_filter int,
    default_message_notifications int,
    system_channel_id bigint,
    system_channel_flags int,
    rules_channel_id bigint,
    afk_channel_id bigint,
    afk_timeout int,
    disabled_operations int,
    member_count int,
    audit_logs_indexed_at timestamp,
    version int,
    PRIMARY KEY ((guild_id))
);

CREATE TABLE IF NOT EXISTS floodilka.guilds_by_owner_id (
    owner_id bigint,
    guild_id bigint,
    PRIMARY KEY ((owner_id), guild_id)
);

CREATE TABLE IF NOT EXISTS floodilka.guild_members (
    guild_id bigint,
    user_id bigint,
    joined_at timestamp,
    nick text,
    avatar_hash text,
    banner_hash text,
    bio text,
    join_source_type int,
    source_invite_code text,
    inviter_id bigint,
    deaf boolean,
    mute boolean,
    communication_disabled_until timestamp,
    role_ids set<bigint>,
    is_premium_sanitized boolean,
    temporary boolean,
    profile_flags int,
    version int,
    PRIMARY KEY ((guild_id), user_id)
);

CREATE TABLE IF NOT EXISTS floodilka.guild_members_by_user_id (
    user_id bigint,
    guild_id bigint,
    PRIMARY KEY ((user_id), guild_id)
);

CREATE TABLE IF NOT EXISTS floodilka.guild_roles (
    guild_id bigint,
    role_id bigint,
    name text,
    permissions bigint,
    position int,
    hoist_position int,
    color int,
    icon_hash text,
    unicode_emoji text,
    hoist boolean,
    mentionable boolean,
    version int,
    PRIMARY KEY ((guild_id), role_id)
);

CREATE TABLE IF NOT EXISTS floodilka.guild_bans (
    guild_id bigint,
    user_id bigint,
    moderator_id bigint,
    banned_at timestamp,
    expires_at timestamp,
    reason text,
    ip text,
    PRIMARY KEY ((guild_id), user_id)
);

CREATE TABLE IF NOT EXISTS floodilka.guild_emojis (
    guild_id bigint,
    emoji_id bigint,
    name text,
    creator_id bigint,
    animated boolean,
    version int,
    PRIMARY KEY ((guild_id), emoji_id)
);

CREATE TABLE IF NOT EXISTS floodilka.guild_emojis_by_emoji_id (
    emoji_id bigint,
    guild_id bigint,
    name text,
    creator_id bigint,
    animated boolean,
    PRIMARY KEY ((emoji_id))
);

CREATE TABLE IF NOT EXISTS floodilka.guild_stickers (
    guild_id bigint,
    sticker_id bigint,
    name text,
    description text,
    format_type int,
    tags list<text>,
    creator_id bigint,
    version int,
    PRIMARY KEY ((guild_id), sticker_id)
);

CREATE TABLE IF NOT EXISTS floodilka.guild_stickers_by_sticker_id (
    sticker_id bigint,
    guild_id bigint,
    name text,
    description text,
    format_type int,
    tags list<text>,
    creator_id bigint,
    PRIMARY KEY ((sticker_id))
);

CREATE TABLE IF NOT EXISTS floodilka.guild_audit_logs_v2 (
    guild_id bigint,
    log_id bigint,
    user_id bigint,
    target_id text,
    action_type int,
    reason text,
    options map<text, text>,
    changes text,
    PRIMARY KEY ((guild_id), log_id)
) WITH CLUSTERING ORDER BY (log_id DESC);

CREATE TABLE IF NOT EXISTS floodilka.guild_audit_logs_v2_by_user (
    guild_id bigint,
    user_id bigint,
    log_id bigint,
    target_id text,
    action_type int,
    reason text,
    options map<text, text>,
    changes text,
    PRIMARY KEY ((guild_id), user_id, log_id)
) WITH CLUSTERING ORDER BY (user_id ASC, log_id DESC);

CREATE TABLE IF NOT EXISTS floodilka.guild_audit_logs_v2_by_action (
    guild_id bigint,
    action_type int,
    log_id bigint,
    user_id bigint,
    target_id text,
    reason text,
    options map<text, text>,
    changes text,
    PRIMARY KEY ((guild_id), action_type, log_id)
) WITH CLUSTERING ORDER BY (action_type ASC, log_id DESC);

CREATE TABLE IF NOT EXISTS floodilka.guild_audit_logs_v2_by_user_action (
    guild_id bigint,
    user_id bigint,
    action_type int,
    log_id bigint,
    target_id text,
    reason text,
    options map<text, text>,
    changes text,
    PRIMARY KEY ((guild_id), user_id, action_type, log_id)
) WITH CLUSTERING ORDER BY (user_id ASC, action_type ASC, log_id DESC);

-- ============================================================================
-- Channels
-- ============================================================================

CREATE TABLE IF NOT EXISTS floodilka.channels (
    channel_id bigint,
    guild_id bigint,
    type int,
    name text,
    topic text,
    icon_hash text,
    parent_id bigint,
    position int,
    owner_id bigint,
    recipient_ids set<bigint>,
    nsfw boolean,
    rate_limit_per_user int,
    bitrate int,
    user_limit int,
    rtc_region text,
    last_message_id bigint,
    last_pin_timestamp timestamp,
    permission_overwrites frozen<map<bigint, permission_overwrite>>,
    nicks map<text, text>,
    soft_deleted boolean,
    indexed_at timestamp,
    version int,
    PRIMARY KEY ((channel_id, soft_deleted))
);

CREATE TABLE IF NOT EXISTS floodilka.channels_by_guild_id (
    guild_id bigint,
    channel_id bigint,
    PRIMARY KEY ((guild_id), channel_id)
);

CREATE TABLE IF NOT EXISTS floodilka.channel_state (
    channel_id bigint,
    created_bucket int,
    has_messages boolean,
    last_message_id bigint,
    last_message_bucket int,
    updated_at timestamp,
    PRIMARY KEY ((channel_id))
);

CREATE TABLE IF NOT EXISTS floodilka.channel_message_buckets (
    channel_id bigint,
    bucket int,
    updated_at timestamp,
    PRIMARY KEY ((channel_id), bucket)
);

CREATE TABLE IF NOT EXISTS floodilka.channel_empty_buckets (
    channel_id bigint,
    bucket int,
    updated_at timestamp,
    PRIMARY KEY ((channel_id), bucket)
);

-- ============================================================================
-- Messages
-- ============================================================================

CREATE TABLE IF NOT EXISTS floodilka.messages (
    channel_id bigint,
    bucket int,
    message_id bigint,
    author_id bigint,
    type int,
    webhook_id bigint,
    webhook_name text,
    webhook_avatar_hash text,
    content text,
    edited_timestamp timestamp,
    pinned_timestamp timestamp,
    flags int,
    mention_everyone boolean,
    mention_users set<bigint>,
    mention_roles set<bigint>,
    mention_channels set<bigint>,
    attachments frozen<list<message_attachment>>,
    embeds frozen<list<message_embed>>,
    sticker_items frozen<list<message_sticker_item>>,
    message_reference frozen<message_reference>,
    message_snapshots frozen<list<message_snapshot>>,
    call frozen<message_call>,
    has_reaction boolean,
    version int,
    PRIMARY KEY ((channel_id, bucket), message_id)
) WITH CLUSTERING ORDER BY (message_id DESC);

CREATE TABLE IF NOT EXISTS floodilka.channel_pins (
    channel_id bigint,
    message_id bigint,
    pinned_timestamp timestamp,
    PRIMARY KEY ((channel_id), pinned_timestamp, message_id)
) WITH CLUSTERING ORDER BY (pinned_timestamp DESC, message_id DESC);

CREATE TABLE IF NOT EXISTS floodilka.messages_by_author_id (
    author_id bigint,
    channel_id bigint,
    message_id bigint,
    PRIMARY KEY ((author_id), channel_id, message_id)
);

CREATE TABLE IF NOT EXISTS floodilka.message_reactions (
    channel_id bigint,
    bucket int,
    message_id bigint,
    emoji_id bigint,
    emoji_name text,
    user_id bigint,
    emoji_animated boolean,
    PRIMARY KEY ((channel_id, bucket, message_id), emoji_id, emoji_name, user_id)
);

CREATE TABLE IF NOT EXISTS floodilka.attachment_lookup (
    channel_id bigint,
    attachment_id bigint,
    filename text,
    message_id bigint,
    PRIMARY KEY ((channel_id), attachment_id, filename)
);

CREATE TABLE IF NOT EXISTS floodilka.scheduled_messages (
    user_id bigint,
    scheduled_message_id bigint,
    channel_id bigint,
    payload text,
    scheduled_at timestamp,
    scheduled_local_at text,
    timezone text,
    status text,
    status_reason text,
    created_at timestamp,
    invalidated_at timestamp,
    PRIMARY KEY ((user_id), scheduled_message_id)
);

-- ============================================================================
-- Private Channels & DMs
-- ============================================================================

CREATE TABLE IF NOT EXISTS floodilka.private_channels (
    user_id bigint,
    channel_id bigint,
    is_gdm boolean,
    PRIMARY KEY ((user_id), channel_id)
);

CREATE TABLE IF NOT EXISTS floodilka.dm_states (
    hi_user_id bigint,
    lo_user_id bigint,
    channel_id bigint,
    PRIMARY KEY ((hi_user_id, lo_user_id), channel_id)
);

CREATE TABLE IF NOT EXISTS floodilka.pinned_dms (
    user_id bigint,
    channel_id bigint,
    sort_order int,
    PRIMARY KEY ((user_id), channel_id)
);

CREATE TABLE IF NOT EXISTS floodilka.read_states (
    user_id bigint,
    channel_id bigint,
    message_id bigint,
    mention_count int,
    last_pin_timestamp timestamp,
    PRIMARY KEY ((user_id), channel_id)
);

CREATE TABLE IF NOT EXISTS floodilka.recent_mentions (
    user_id bigint,
    message_id bigint,
    channel_id bigint,
    guild_id bigint,
    is_everyone boolean,
    is_role boolean,
    PRIMARY KEY ((user_id), message_id)
) WITH CLUSTERING ORDER BY (message_id DESC)
AND default_time_to_live = 604800;

CREATE TABLE IF NOT EXISTS floodilka.recent_mentions_by_guild (
    user_id bigint,
    guild_id bigint,
    message_id bigint,
    channel_id bigint,
    is_everyone boolean,
    is_role boolean,
    PRIMARY KEY ((user_id, guild_id), message_id)
) WITH CLUSTERING ORDER BY (message_id DESC)
AND default_time_to_live = 604800;

CREATE TABLE IF NOT EXISTS floodilka.saved_messages (
    user_id bigint,
    channel_id bigint,
    message_id bigint,
    saved_at timestamp,
    PRIMARY KEY ((user_id), message_id)
) WITH CLUSTERING ORDER BY (message_id DESC);

-- ============================================================================
-- Invites
-- ============================================================================

CREATE TABLE IF NOT EXISTS floodilka.invites (
    code text,
    type int,
    guild_id bigint,
    channel_id bigint,
    inviter_id bigint,
    created_at timestamp,
    uses int,
    max_uses int,
    max_age int,
    temporary boolean,
    version int,
    PRIMARY KEY ((code))
);

CREATE TABLE IF NOT EXISTS floodilka.invites_by_guild_id (
    guild_id bigint,
    code text,
    PRIMARY KEY ((guild_id), code)
);

CREATE TABLE IF NOT EXISTS floodilka.invites_by_channel_id (
    channel_id bigint,
    code text,
    PRIMARY KEY ((channel_id), code)
);

-- ============================================================================
-- Webhooks
-- ============================================================================

CREATE TABLE IF NOT EXISTS floodilka.webhooks (
    webhook_id bigint,
    webhook_token text,
    type int,
    guild_id bigint,
    channel_id bigint,
    creator_id bigint,
    name text,
    avatar_hash text,
    version int,
    PRIMARY KEY ((webhook_id), webhook_token)
);

CREATE TABLE IF NOT EXISTS floodilka.webhooks_by_guild_id (
    guild_id bigint,
    webhook_id bigint,
    PRIMARY KEY ((guild_id), webhook_id)
);

CREATE TABLE IF NOT EXISTS floodilka.webhooks_by_channel_id (
    channel_id bigint,
    webhook_id bigint,
    PRIMARY KEY ((channel_id), webhook_id)
);

-- ============================================================================
-- Payments & Gift Codes
-- ============================================================================

CREATE TABLE IF NOT EXISTS floodilka.payments (
    payment_id text,
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
    version int,
    PRIMARY KEY ((payment_id))
);

CREATE TABLE IF NOT EXISTS floodilka.payments_by_transaction (
    cloudpayments_transaction_id bigint,
    payment_id text,
    PRIMARY KEY ((cloudpayments_transaction_id))
);

CREATE TABLE IF NOT EXISTS floodilka.payments_by_user (
    user_id bigint,
    created_at timestamp,
    payment_id text,
    PRIMARY KEY ((user_id), created_at)
) WITH CLUSTERING ORDER BY (created_at DESC);

CREATE TABLE IF NOT EXISTS floodilka.gift_codes (
    code text,
    duration_months int,
    created_at timestamp,
    created_by_user_id bigint,
    redeemed_at timestamp,
    redeemed_by_user_id bigint,
    cloudpayments_transaction_id bigint,
    payment_id text,
    version int,
    PRIMARY KEY ((code))
);

CREATE TABLE IF NOT EXISTS floodilka.gift_codes_by_creator (
    created_by_user_id bigint,
    code text,
    PRIMARY KEY ((created_by_user_id), code)
);

CREATE TABLE IF NOT EXISTS floodilka.gift_codes_by_redeemer (
    redeemed_by_user_id bigint,
    code text,
    PRIMARY KEY ((redeemed_by_user_id), code)
);

CREATE TABLE IF NOT EXISTS floodilka.gift_codes_by_transaction (
    cloudpayments_transaction_id bigint,
    code text,
    PRIMARY KEY ((cloudpayments_transaction_id), code)
);

-- ============================================================================
-- Expression Packs & Memes
-- ============================================================================

CREATE TABLE IF NOT EXISTS floodilka.expression_packs (
    pack_id bigint,
    pack_type text,
    creator_id bigint,
    name text,
    description text,
    created_at timestamp,
    updated_at timestamp,
    version int,
    PRIMARY KEY ((pack_id))
);

CREATE TABLE IF NOT EXISTS floodilka.expression_packs_by_creator (
    creator_id bigint,
    pack_id bigint,
    pack_type text,
    name text,
    description text,
    created_at timestamp,
    updated_at timestamp,
    version int,
    PRIMARY KEY ((creator_id), pack_id)
);

CREATE TABLE IF NOT EXISTS floodilka.pack_installations (
    user_id bigint,
    pack_id bigint,
    pack_type text,
    installed_at timestamp,
    PRIMARY KEY ((user_id), pack_id)
);

CREATE TABLE IF NOT EXISTS floodilka.favorite_memes (
    user_id bigint,
    meme_id bigint,
    name text,
    alt_text text,
    tags list<text>,
    attachment_id bigint,
    filename text,
    content_type text,
    content_hash text,
    size bigint,
    width int,
    height int,
    duration int,
    is_gifv boolean,
    klipy_id text,
    version int,
    PRIMARY KEY ((user_id), meme_id)
) WITH CLUSTERING ORDER BY (meme_id DESC);

CREATE TABLE IF NOT EXISTS floodilka.favorite_memes_by_meme_id (
    meme_id bigint,
    user_id bigint,
    PRIMARY KEY ((meme_id), user_id)
);

-- ============================================================================
-- Applications & OAuth2
-- ============================================================================

CREATE TABLE IF NOT EXISTS floodilka.applications (
    application_id bigint,
    owner_user_id bigint,
    name text,
    bot_user_id bigint,
    bot_is_public boolean,
    oauth2_redirect_uris set<text>,
    client_secret_hash text,
    bot_token_hash text,
    bot_token_preview text,
    bot_token_created_at timestamp,
    client_secret_created_at timestamp,
    version int,
    PRIMARY KEY ((application_id))
);

CREATE TABLE IF NOT EXISTS floodilka.applications_by_owner (
    owner_user_id bigint,
    application_id bigint,
    PRIMARY KEY ((owner_user_id), application_id)
);

CREATE TABLE IF NOT EXISTS floodilka.oauth2_authorization_codes (
    code text,
    application_id bigint,
    user_id bigint,
    redirect_uri text,
    scope set<text>,
    nonce text,
    created_at timestamp,
    PRIMARY KEY ((code))
) WITH default_time_to_live = 600;

CREATE TABLE IF NOT EXISTS floodilka.oauth2_access_tokens (
    token_ text,
    application_id bigint,
    user_id bigint,
    scope set<text>,
    created_at timestamp,
    PRIMARY KEY ((token_))
);

CREATE TABLE IF NOT EXISTS floodilka.oauth2_access_tokens_by_user (
    user_id bigint,
    token_ text,
    PRIMARY KEY ((user_id), token_)
);

CREATE TABLE IF NOT EXISTS floodilka.oauth2_refresh_tokens (
    token_ text,
    application_id bigint,
    user_id bigint,
    scope set<text>,
    created_at timestamp,
    PRIMARY KEY ((token_))
);

CREATE TABLE IF NOT EXISTS floodilka.oauth2_refresh_tokens_by_user (
    user_id bigint,
    token_ text,
    PRIMARY KEY ((user_id), token_)
);

-- ============================================================================
-- Reports & Admin
-- ============================================================================

CREATE TABLE IF NOT EXISTS floodilka.iar_submissions (
    report_id bigint,
    reporter_id bigint,
    reporter_email text,
    reporter_full_legal_name text,
    reporter_country_of_residence text,
    reported_at timestamp,
    status int,
    report_type int,
    category text,
    additional_info text,
    reported_user_id bigint,
    reported_user_avatar_hash text,
    reported_guild_id bigint,
    reported_guild_name text,
    reported_guild_icon_hash text,
    reported_message_id bigint,
    reported_channel_id bigint,
    reported_channel_name text,
    message_context frozen<list<iar_message_context>>,
    guild_context_id bigint,
    resolved_at timestamp,
    resolved_by_admin_id bigint,
    public_comment text,
    audit_log_reason text,
    reported_guild_invite_code text,
    PRIMARY KEY ((report_id))
);

CREATE TABLE IF NOT EXISTS floodilka.dsa_report_email_verifications (
    email_lower text,
    code_hash text,
    expires_at timestamp,
    last_sent_at timestamp,
    PRIMARY KEY ((email_lower))
);

CREATE TABLE IF NOT EXISTS floodilka.dsa_report_tickets (
    ticket text,
    email_lower text,
    expires_at timestamp,
    created_at timestamp,
    PRIMARY KEY ((ticket))
);

CREATE TABLE IF NOT EXISTS floodilka.admin_archives_by_subject (
    subject_type text,
    subject_id bigint,
    archive_id bigint,
    requested_by bigint,
    requested_at timestamp,
    started_at timestamp,
    completed_at timestamp,
    failed_at timestamp,
    storage_key text,
    file_size bigint,
    progress_percent int,
    progress_step text,
    error_message text,
    download_url_expires_at timestamp,
    expires_at timestamp,
    PRIMARY KEY ((subject_type, subject_id), archive_id)
) WITH CLUSTERING ORDER BY (archive_id DESC);

CREATE TABLE IF NOT EXISTS floodilka.admin_archives_by_requester (
    requested_by bigint,
    archive_id bigint,
    subject_type text,
    subject_id bigint,
    requested_at timestamp,
    started_at timestamp,
    completed_at timestamp,
    failed_at timestamp,
    storage_key text,
    file_size bigint,
    progress_percent int,
    progress_step text,
    error_message text,
    download_url_expires_at timestamp,
    expires_at timestamp,
    PRIMARY KEY ((requested_by), archive_id)
) WITH CLUSTERING ORDER BY (archive_id DESC);

CREATE TABLE IF NOT EXISTS floodilka.admin_archives_by_type (
    subject_type text,
    archive_id bigint,
    subject_id bigint,
    requested_by bigint,
    requested_at timestamp,
    started_at timestamp,
    completed_at timestamp,
    failed_at timestamp,
    storage_key text,
    file_size bigint,
    progress_percent int,
    progress_step text,
    error_message text,
    download_url_expires_at timestamp,
    expires_at timestamp,
    PRIMARY KEY ((subject_type), archive_id)
) WITH CLUSTERING ORDER BY (archive_id DESC);

CREATE TABLE IF NOT EXISTS floodilka.admin_audit_logs (
    log_id bigint PRIMARY KEY,
    admin_user_id bigint,
    target_type text,
    target_id bigint,
    action text,
    audit_log_reason text,
    metadata map<text, text>,
    created_at timestamp
);

-- ============================================================================
-- Push Subscriptions
-- ============================================================================

CREATE TABLE IF NOT EXISTS floodilka.push_subscriptions (
    user_id bigint,
    subscription_id text,
    endpoint text,
    p256dh_key text,
    auth_key text,
    user_agent text,
    PRIMARY KEY ((user_id), subscription_id)
);

-- ============================================================================
-- Attachments
-- ============================================================================

CREATE TABLE IF NOT EXISTS floodilka.attachment_decay_by_id (
    attachment_id bigint,
    channel_id bigint,
    message_id bigint,
    filename text,
    size_bytes bigint,
    uploaded_at timestamp,
    expires_at timestamp,
    last_accessed_at timestamp,
    cost int,
    lifetime_days int,
    status text,
    PRIMARY KEY ((attachment_id))
);

CREATE TABLE IF NOT EXISTS floodilka.attachment_decay_by_expiry (
    expiry_bucket int,
    expires_at timestamp,
    attachment_id bigint,
    channel_id bigint,
    message_id bigint,
    PRIMARY KEY ((expiry_bucket), expires_at, attachment_id)
) WITH CLUSTERING ORDER BY (expires_at ASC, attachment_id ASC);

-- ============================================================================
-- Voice
-- ============================================================================

CREATE TABLE IF NOT EXISTS floodilka.voice_regions (
    id text,
    name text,
    emoji text,
    latitude double,
    longitude double,
    is_default boolean,
    vip_only boolean,
    required_guild_features set<text>,
    allowed_guild_ids set<bigint>,
    allowed_user_ids set<bigint>,
    created_at timestamp,
    updated_at timestamp,
    PRIMARY KEY ((id))
);

CREATE TABLE IF NOT EXISTS floodilka.voice_servers (
    region_id text,
    server_id text,
    endpoint text,
    api_key text,
    api_secret text,
    is_active boolean,
    vip_only boolean,
    required_guild_features set<text>,
    allowed_guild_ids set<bigint>,
    allowed_user_ids set<bigint>,
    created_at timestamp,
    updated_at timestamp,
    PRIMARY KEY ((region_id), server_id)
);

-- ============================================================================
-- Instance Configuration
-- ============================================================================

CREATE TABLE IF NOT EXISTS floodilka.instance_configuration (
    key text,
    value text,
    updated_at timestamp,
    PRIMARY KEY ((key))
);
