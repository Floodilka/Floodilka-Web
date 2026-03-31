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

import floodilka_admin/api/assets
import floodilka_admin/api/guilds
import floodilka_admin/api/search
import floodilka_admin/components/flash
import floodilka_admin/web.{type Context, type Session}
import gleam/int
import gleam/list
import gleam/option
import gleam/result
import gleam/string
import wisp.{type Request, type Response}

pub fn handle_clear_fields(
  req: Request,
  ctx: Context,
  session: Session,
  guild_id: String,
  redirect_url: String,
) -> Response {
  use form_data <- wisp.require_form(req)

  let fields = case list.key_find(form_data.values, "fields") {
    Ok(value) -> [value]
    Error(_) -> []
  }

  case guilds.clear_guild_fields(ctx, session, guild_id, fields) {
    Ok(_) ->
      flash.redirect_with_success(
        ctx,
        redirect_url,
        "Поля сервера успешно очищены",
      )
    Error(_) ->
      flash.redirect_with_error(
        ctx,
        redirect_url,
        "Не удалось очистить поля сервера",
      )
  }
}

pub fn handle_update_features(
  req: Request,
  ctx: Context,
  session: Session,
  guild_id: String,
  redirect_url: String,
) -> Response {
  use form_data <- wisp.require_form(req)

  let guild_result = guilds.lookup_guild(ctx, session, guild_id)

  case guild_result {
    Error(_) -> flash.redirect_with_error(ctx, redirect_url, "Сервер не найден")
    Ok(option.None) ->
      flash.redirect_with_error(ctx, redirect_url, "Сервер не найден")
    Ok(option.Some(current_guild)) -> {
      let submitted_features =
        list.filter_map(form_data.values, fn(field) {
          case field.0 {
            "features[]" -> Ok(field.1)
            _ -> Error(Nil)
          }
        })

      let custom_features_input =
        list.key_find(form_data.values, "custom_features")
        |> result.unwrap("")

      let custom_features =
        string.split(custom_features_input, ",")
        |> list.map(string.trim)
        |> list.filter(fn(s) { s != "" })

      let submitted_features = list.append(submitted_features, custom_features)

      let submitted_features = case
        list.contains(submitted_features, "UNAVAILABLE_FOR_EVERYONE")
        && list.contains(
          submitted_features,
          "UNAVAILABLE_FOR_EVERYONE_BUT_STAFF",
        )
      {
        True ->
          list.filter(submitted_features, fn(f) {
            f != "UNAVAILABLE_FOR_EVERYONE_BUT_STAFF"
          })
        False -> submitted_features
      }

      let add_features =
        list.filter(submitted_features, fn(feature) {
          !list.contains(current_guild.features, feature)
        })

      let remove_features =
        list.filter(current_guild.features, fn(feature) {
          !list.contains(submitted_features, feature)
        })

      case
        guilds.update_guild_features(
          ctx,
          session,
          guild_id,
          add_features,
          remove_features,
        )
      {
        Ok(_) ->
          flash.redirect_with_success(
            ctx,
            redirect_url,
            "Функции сервера успешно обновлены",
          )
        Error(_) ->
          flash.redirect_with_error(
            ctx,
            redirect_url,
            "Не удалось обновить функции сервера",
          )
      }
    }
  }
}

pub fn handle_update_disabled_operations(
  req: Request,
  ctx: Context,
  session: Session,
  guild_id: String,
  redirect_url: String,
) -> Response {
  use form_data <- wisp.require_form(req)

  let checked_ops =
    list.filter_map(form_data.values, fn(field) {
      case field.0 {
        "disabled_operations[]" -> Ok(field.1)
        _ -> Error(Nil)
      }
    })

  let disabled_ops_value =
    list.fold(checked_ops, 0, fn(acc, op_str) {
      case int.parse(op_str) {
        Ok(val) -> int.bitwise_or(acc, val)
        Error(_) -> acc
      }
    })

  case
    guilds.update_guild_settings(
      ctx,
      session,
      guild_id,
      option.None,
      option.None,
      option.None,
      option.None,
      option.None,
      option.Some(disabled_ops_value),
    )
  {
    Ok(_) ->
      flash.redirect_with_success(
        ctx,
        redirect_url,
        "Отключённые операции успешно обновлены",
      )
    Error(_) ->
      flash.redirect_with_error(
        ctx,
        redirect_url,
        "Не удалось обновить отключённые операции",
      )
  }
}

pub fn handle_update_name(
  req: Request,
  ctx: Context,
  session: Session,
  guild_id: String,
  redirect_url: String,
) -> Response {
  use form_data <- wisp.require_form(req)

  let name = list.key_find(form_data.values, "name") |> result.unwrap("")

  case guilds.update_guild_name(ctx, session, guild_id, name) {
    Ok(_) ->
      flash.redirect_with_success(
        ctx,
        redirect_url,
        "Название сервера успешно обновлено",
      )
    Error(_) ->
      flash.redirect_with_error(
        ctx,
        redirect_url,
        "Не удалось обновить название сервера",
      )
  }
}

pub fn handle_update_vanity(
  req: Request,
  ctx: Context,
  session: Session,
  guild_id: String,
  redirect_url: String,
) -> Response {
  use form_data <- wisp.require_form(req)

  let vanity = case list.key_find(form_data.values, "vanity_url_code") {
    Ok("") -> option.None
    Ok(code) -> option.Some(code)
    Error(_) -> option.None
  }

  case guilds.update_guild_vanity(ctx, session, guild_id, vanity) {
    Ok(_) ->
      flash.redirect_with_success(
        ctx,
        redirect_url,
        "Vanity URL успешно обновлён",
      )
    Error(_) ->
      flash.redirect_with_error(
        ctx,
        redirect_url,
        "Не удалось обновить vanity URL",
      )
  }
}

pub fn handle_transfer_ownership(
  req: Request,
  ctx: Context,
  session: Session,
  guild_id: String,
  redirect_url: String,
) -> Response {
  use form_data <- wisp.require_form(req)

  let new_owner_id =
    list.key_find(form_data.values, "new_owner_id") |> result.unwrap("")

  case guilds.transfer_guild_ownership(ctx, session, guild_id, new_owner_id) {
    Ok(_) ->
      flash.redirect_with_success(
        ctx,
        redirect_url,
        "Владелец сервера успешно изменён",
      )
    Error(_) ->
      flash.redirect_with_error(
        ctx,
        redirect_url,
        "Не удалось передать владение сервером",
      )
  }
}

pub fn handle_reload(
  ctx: Context,
  session: Session,
  guild_id: String,
  redirect_url: String,
) -> Response {
  case guilds.reload_guild(ctx, session, guild_id) {
    Ok(_) ->
      flash.redirect_with_success(
        ctx,
        redirect_url,
        "Сервер успешно перезагружен",
      )
    Error(_) ->
      flash.redirect_with_error(ctx, redirect_url, "Не удалось перезагрузить сервер")
  }
}

pub fn handle_shutdown(
  ctx: Context,
  session: Session,
  guild_id: String,
  redirect_url: String,
) -> Response {
  case guilds.shutdown_guild(ctx, session, guild_id) {
    Ok(_) ->
      flash.redirect_with_success(
        ctx,
        redirect_url,
        "Сервер успешно остановлен",
      )
    Error(_) ->
      flash.redirect_with_error(ctx, redirect_url, "Не удалось остановить сервер")
  }
}

pub fn handle_delete_guild(
  ctx: Context,
  session: Session,
  guild_id: String,
  redirect_url: String,
) -> Response {
  case guilds.delete_guild(ctx, session, guild_id) {
    Ok(_) ->
      flash.redirect_with_success(
        ctx,
        redirect_url,
        "Сервер успешно удалён",
      )
    Error(_) ->
      flash.redirect_with_error(ctx, redirect_url, "Не удалось удалить сервер")
  }
}

pub fn handle_update_settings(
  req: Request,
  ctx: Context,
  session: Session,
  guild_id: String,
  redirect_url: String,
) -> Response {
  use form_data <- wisp.require_form(req)

  let verification_level =
    list.key_find(form_data.values, "verification_level")
    |> result.try(int.parse)
    |> option.from_result

  let mfa_level =
    list.key_find(form_data.values, "mfa_level")
    |> result.try(int.parse)
    |> option.from_result

  let nsfw_level =
    list.key_find(form_data.values, "nsfw_level")
    |> result.try(int.parse)
    |> option.from_result

  let explicit_content_filter =
    list.key_find(form_data.values, "explicit_content_filter")
    |> result.try(int.parse)
    |> option.from_result

  let default_message_notifications =
    list.key_find(form_data.values, "default_message_notifications")
    |> result.try(int.parse)
    |> option.from_result

  case
    guilds.update_guild_settings(
      ctx,
      session,
      guild_id,
      verification_level,
      mfa_level,
      nsfw_level,
      explicit_content_filter,
      default_message_notifications,
      option.None,
    )
  {
    Ok(_) ->
      flash.redirect_with_success(
        ctx,
        redirect_url,
        "Настройки сервера успешно обновлены",
      )
    Error(_) ->
      flash.redirect_with_error(
        ctx,
        redirect_url,
        "Не удалось обновить настройки сервера",
      )
  }
}

pub fn handle_force_add_user(
  req: Request,
  ctx: Context,
  session: Session,
  guild_id: String,
  redirect_url: String,
) -> Response {
  use form_data <- wisp.require_form(req)

  let user_id = list.key_find(form_data.values, "user_id") |> result.unwrap("")

  case guilds.force_add_user_to_guild(ctx, session, user_id, guild_id) {
    Ok(_) ->
      flash.redirect_with_success(
        ctx,
        redirect_url,
        "Пользователь успешно добавлен на сервер",
      )
    Error(_) ->
      flash.redirect_with_error(
        ctx,
        redirect_url,
        "Не удалось добавить пользователя на сервер",
      )
  }
}

pub fn handle_refresh_search_index(
  req: Request,
  ctx: Context,
  session: Session,
  guild_id: String,
  redirect_url: String,
) -> Response {
  use form_data <- wisp.require_form(req)

  let index_type =
    list.key_find(form_data.values, "index_type") |> result.unwrap("")

  case
    search.refresh_search_index_with_guild(
      ctx,
      session,
      index_type,
      option.Some(guild_id),
      option.None,
    )
  {
    Ok(response) ->
      flash.redirect_with_success(
        ctx,
        "/search-index?job_id=" <> response.job_id,
        "Обновление поискового индекса запущено",
      )
    Error(_) ->
      flash.redirect_with_error(
        ctx,
        redirect_url,
        "Не удалось запустить обновление поискового индекса",
      )
  }
}

pub fn handle_delete_emoji(
  req: Request,
  ctx: Context,
  session: Session,
  _guild_id: String,
  redirect_url: String,
) -> Response {
  use form_data <- wisp.require_form(req)

  let emoji_id =
    list.key_find(form_data.values, "emoji_id")
    |> result.unwrap("")
    |> string.trim

  case emoji_id {
    "" -> flash.redirect_with_error(ctx, redirect_url, "Требуется ID эмодзи.")
    _ -> handle_delete_asset(ctx, session, redirect_url, emoji_id, "Эмодзи")
  }
}

pub fn handle_delete_sticker(
  req: Request,
  ctx: Context,
  session: Session,
  _guild_id: String,
  redirect_url: String,
) -> Response {
  use form_data <- wisp.require_form(req)

  let sticker_id =
    list.key_find(form_data.values, "sticker_id")
    |> result.unwrap("")
    |> string.trim

  case sticker_id {
    "" ->
      flash.redirect_with_error(ctx, redirect_url, "Требуется ID стикера.")
    _ -> handle_delete_asset(ctx, session, redirect_url, sticker_id, "Стикер")
  }
}

fn handle_delete_asset(
  ctx: Context,
  session: Session,
  redirect_url: String,
  asset_id: String,
  asset_label: String,
) -> Response {
  case assets.purge_assets(ctx, session, [asset_id], option.None) {
    Ok(response) -> {
      case list.find(response.errors, fn(err) { err.id == asset_id }) {
        Ok(err) ->
          flash.redirect_with_error(
            ctx,
            redirect_url,
            asset_label <> ": ошибка удаления — " <> err.error,
          )
        Error(_) ->
          flash.redirect_with_success(
            ctx,
            redirect_url,
            asset_label <> " успешно удалён.",
          )
      }
    }
    Error(_) ->
      flash.redirect_with_error(
        ctx,
        redirect_url,
        asset_label <> ": ошибка удаления.",
      )
  }
}
