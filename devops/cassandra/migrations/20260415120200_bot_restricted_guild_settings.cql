ALTER TABLE floodilka.user_settings ADD bot_default_guilds_restricted boolean;
ALTER TABLE floodilka.user_settings ADD bot_restricted_guilds set<bigint>;
