//// Copyright (C) 2026 Floodilka Contributors
////
//// This file is part of Floodilka.
////
//// Floodilka is free software: you can redistribute it and/or modify
//// it under the terms of the GNU Affero General Public License as published by
//// the Free Software Foundation, either version 3 of the License, or
//// (at your option) any later version.
////
//// Floodilka is distributed in the hope that it will be useful,
//// but WITHOUT ANY WARRANTY; without even the implied warranty of
//// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
//// GNU Affero General Public License for more details.
////
//// You should have received a copy of the GNU Affero General Public License
//// along with Floodilka. If not, see <https://www.gnu.org/licenses/>.

import floodilka_admin/acl
import floodilka_admin/constants
import gleam/list
import gleam/option

pub type NavItem {
  NavItem(
    title: String,
    path: String,
    active_key: String,
    required_acls: List(String),
  )
}

pub type NavSection {
  NavSection(title: String, items: List(NavItem))
}

pub fn sections() -> List(NavSection) {
  [
    NavSection("Система", [
      NavItem("Панель управления", "/dashboard", "dashboard", [
        constants.acl_gateway_memory_stats,
      ]),
    ]),
    NavSection("Поиск", [
      NavItem("Пользователи", "/users", "users", [constants.acl_user_lookup]),
      NavItem("Серверы", "/guilds", "guilds", [constants.acl_guild_lookup]),
    ]),
    NavSection("Модерация", [
      NavItem("Жалобы", "/reports", "reports", [constants.acl_report_view]),
      NavItem("Массовые действия", "/bulk-actions", "bulk-actions", [
        constants.acl_bulk_update_user_flags,
        constants.acl_bulk_update_guild_features,
        constants.acl_bulk_add_guild_members,
        constants.acl_bulk_delete_users,
      ]),
    ]),
    NavSection("Баны", [
      NavItem("Баны по IP", "/ip-bans", "ip-bans", [
        constants.acl_ban_ip_check,
        constants.acl_ban_ip_add,
        constants.acl_ban_ip_remove,
      ]),
      NavItem("Баны по Email", "/email-bans", "email-bans", [
        constants.acl_ban_email_check,
        constants.acl_ban_email_add,
        constants.acl_ban_email_remove,
      ]),
      NavItem("Баны по телефону", "/phone-bans", "phone-bans", [
        constants.acl_ban_phone_check,
        constants.acl_ban_phone_add,
        constants.acl_ban_phone_remove,
      ]),
    ]),
    NavSection("Контент", [
      NavItem("Сообщения", "/messages", "message-tools", [
        constants.acl_message_lookup,
        constants.acl_message_delete,
        constants.acl_message_shred,
        constants.acl_message_delete_all,
      ]),
      NavItem("Архивы", "/archives", "archives", [
        constants.acl_archive_view_all,
        constants.acl_archive_trigger_user,
        constants.acl_archive_trigger_guild,
      ]),
      NavItem("Очистка ресурсов", "/asset-purge", "asset-purge", [
        constants.acl_asset_purge,
      ]),
    ]),
    NavSection("Метрики", [
      NavItem("Обзор", "/metrics", "metrics", [constants.acl_metrics_view]),
      NavItem("Сообщения и API", "/messages-metrics", "messages-metrics", [
        constants.acl_metrics_view,
      ]),
    ]),
    NavSection("Мониторинг", [
      NavItem("Шлюз", "/gateway", "gateway", [
        constants.acl_gateway_memory_stats,
        constants.acl_gateway_reload_all,
      ]),
      NavItem("Голосовой монитор", "/voice-monitor", "voice-monitor", [
        constants.acl_gateway_memory_stats,
      ]),
      NavItem("Задачи", "/jobs", "jobs", [constants.acl_metrics_view]),
      NavItem("Хранилище", "/storage", "storage", [constants.acl_metrics_view]),
      NavItem("Журнал аудита", "/audit-logs", "audit-logs", [
        constants.acl_audit_log_view,
      ]),
      NavItem("Серверы", "/monitoring", "monitoring", [
        constants.acl_metrics_view,
      ]),
    ]),
    NavSection("Платформа", [
      NavItem("Поисковые индексы", "/search-index", "search-index", [
        constants.acl_guild_lookup,
      ]),
      NavItem("Голосовые регионы", "/voice-regions", "voice-regions", [
        constants.acl_voice_region_list,
      ]),
      NavItem("Голосовые серверы", "/voice-servers", "voice-servers", [
        constants.acl_voice_server_list,
      ]),
    ]),
    NavSection("Конфигурация", [
      NavItem("Настройки инстанса", "/instance-config", "instance-config", [
        constants.acl_instance_config_view,
        constants.acl_instance_config_update,
      ]),
      NavItem("Флаги функций", "/feature-flags", "feature-flags", [
        constants.acl_feature_flag_view,
        constants.acl_feature_flag_manage,
      ]),
    ]),
    NavSection("Коды", [
      NavItem("Подарочные коды", "/gift-codes", "gift-codes", [
        constants.acl_gift_codes_generate,
      ]),
    ]),
  ]
}

pub fn accessible_sections(admin_acls: List(String)) -> List(NavSection) {
  sections()
  |> list.map(fn(section) {
    let visible_items =
      list.filter(section.items, fn(item) {
        has_access(admin_acls, item.required_acls)
      })

    NavSection(section.title, visible_items)
  })
  |> list.filter(fn(section) { !list.is_empty(section.items) })
}

pub fn first_accessible_path(admin_acls: List(String)) -> option.Option(String) {
  case accessible_sections(admin_acls) {
    [] -> option.None
    [section, ..] ->
      case section.items {
        [] -> option.None
        [item, ..] -> option.Some(item.path)
      }
  }
}

fn has_access(admin_acls: List(String), required_acls: List(String)) -> Bool {
  case required_acls {
    [] -> True
    _ ->
      list.any(required_acls, fn(required_acl) {
        acl.has_permission(admin_acls, required_acl)
      })
  }
}
