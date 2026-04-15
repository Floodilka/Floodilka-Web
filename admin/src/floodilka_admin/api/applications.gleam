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

import floodilka_admin/api/common.{
  type ApiError, Forbidden, NetworkError, NotFound, ServerError, Unauthorized,
}
import floodilka_admin/web.{type Context, type Session}
import gleam/dynamic/decode
import gleam/http
import gleam/http/request
import gleam/httpc
import gleam/json
import gleam/option

pub type ApplicationBot {
  ApplicationBot(id: String, username: String, token_preview: option.Option(String))
}

pub type Application {
  Application(
    id: String,
    name: String,
    bot_public: Bool,
    bot_require_code_grant: Bool,
    redirect_uris: List(String),
    bot: option.Option(ApplicationBot),
  )
}

fn bot_decoder() -> decode.Decoder(ApplicationBot) {
  use id <- decode.field("id", decode.string)
  use username <- decode.field("username", decode.string)
  decode.success(ApplicationBot(id:, username:, token_preview: option.None))
}

fn application_decoder() -> decode.Decoder(Application) {
  use id <- decode.field("id", decode.string)
  use name <- decode.field("name", decode.string)
  use bot_public <- decode.optional_field("bot_public", False, decode.bool)
  use bot_require_code_grant <- decode.optional_field(
    "bot_require_code_grant",
    False,
    decode.bool,
  )
  use redirect_uris <- decode.optional_field(
    "redirect_uris",
    [],
    decode.list(decode.string),
  )
  use bot <- decode.optional_field(
    "bot",
    option.None,
    decode.optional(bot_decoder()),
  )
  decode.success(Application(
    id:,
    name:,
    bot_public:,
    bot_require_code_grant:,
    redirect_uris:,
    bot:,
  ))
}

pub fn list_by_owner(
  ctx: Context,
  session: Session,
  owner_user_id: String,
) -> Result(List(Application), ApiError) {
  let url = ctx.api_endpoint <> "/admin/applications/list-by-owner"
  let body =
    json.object([#("owner_user_id", json.string(owner_user_id))])
    |> json.to_string

  let assert Ok(req) = request.to(url)
  let req =
    req
    |> request.set_method(http.Post)
    |> request.set_header("authorization", "Bearer " <> session.access_token)
    |> request.set_header("content-type", "application/json")
    |> request.set_body(body)

  case httpc.send(req) {
    Ok(resp) if resp.status == 200 -> {
      let decoder = {
        use applications <- decode.field(
          "applications",
          decode.list(application_decoder()),
        )
        decode.success(applications)
      }
      case json.parse(resp.body, decoder) {
        Ok(apps) -> Ok(apps)
        Error(_) -> Error(ServerError)
      }
    }
    Ok(resp) if resp.status == 401 -> Error(Unauthorized)
    Ok(resp) if resp.status == 403 -> Error(Forbidden("Доступ запрещён"))
    Ok(resp) if resp.status == 404 -> Error(NotFound)
    Ok(_resp) -> Error(ServerError)
    Error(_) -> Error(NetworkError)
  }
}

pub fn delete_application(
  ctx: Context,
  session: Session,
  application_id: String,
) -> Result(Nil, ApiError) {
  let url = ctx.api_endpoint <> "/admin/applications/" <> application_id

  let assert Ok(req) = request.to(url)
  let req =
    req
    |> request.set_method(http.Delete)
    |> request.set_header("authorization", "Bearer " <> session.access_token)

  case httpc.send(req) {
    Ok(resp) if resp.status == 204 -> Ok(Nil)
    Ok(resp) if resp.status == 200 -> Ok(Nil)
    Ok(resp) if resp.status == 401 -> Error(Unauthorized)
    Ok(resp) if resp.status == 403 -> Error(Forbidden("Доступ запрещён"))
    Ok(resp) if resp.status == 404 -> Error(NotFound)
    Ok(_resp) -> Error(ServerError)
    Error(_) -> Error(NetworkError)
  }
}

pub fn revoke_bot_token(
  ctx: Context,
  session: Session,
  application_id: String,
) -> Result(String, ApiError) {
  let url =
    ctx.api_endpoint
    <> "/admin/applications/"
    <> application_id
    <> "/revoke-bot-token"

  let assert Ok(req) = request.to(url)
  let req =
    req
    |> request.set_method(http.Post)
    |> request.set_header("authorization", "Bearer " <> session.access_token)
    |> request.set_header("content-type", "application/json")
    |> request.set_body("{}")

  case httpc.send(req) {
    Ok(resp) if resp.status == 200 -> {
      let decoder = {
        use token <- decode.field("token", decode.string)
        decode.success(token)
      }
      case json.parse(resp.body, decoder) {
        Ok(token) -> Ok(token)
        Error(_) -> Error(ServerError)
      }
    }
    Ok(resp) if resp.status == 401 -> Error(Unauthorized)
    Ok(resp) if resp.status == 403 -> Error(Forbidden("Доступ запрещён"))
    Ok(resp) if resp.status == 404 -> Error(NotFound)
    Ok(_resp) -> Error(ServerError)
    Error(_) -> Error(NetworkError)
  }
}
