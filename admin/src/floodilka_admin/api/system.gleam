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
import gleam/int
import gleam/json
import gleam/option

pub type ProcessMemoryStats {
  ProcessMemoryStats(
    guild_id: option.Option(String),
    guild_name: String,
    guild_icon: option.Option(String),
    memory_mb: Float,
    member_count: Int,
    session_count: Int,
    presence_count: Int,
  )
}

pub type ProcessMemoryStatsResponse {
  ProcessMemoryStatsResponse(guilds: List(ProcessMemoryStats))
}

pub fn get_guild_memory_stats(
  ctx: Context,
  session: Session,
  limit: Int,
) -> Result(ProcessMemoryStatsResponse, ApiError) {
  let url = ctx.api_endpoint <> "/admin/gateway/memory-stats"
  let body = json.object([#("limit", json.int(limit))]) |> json.to_string

  let assert Ok(req) = request.to(url)
  let req =
    req
    |> request.set_method(http.Post)
    |> request.set_header("authorization", "Bearer " <> session.access_token)
    |> request.set_header("content-type", "application/json")
    |> request.set_body(body)

  case httpc.send(req) {
    Ok(resp) if resp.status == 200 -> {
      let guild_decoder = {
        use guild_id <- decode.field("guild_id", decode.optional(decode.string))
        use guild_name <- decode.field("guild_name", decode.string)
        use guild_icon <- decode.field(
          "guild_icon",
          decode.optional(decode.string),
        )
        use memory <- decode.field("memory", decode.int)
        use member_count <- decode.field("member_count", decode.int)
        use session_count <- decode.field("session_count", decode.int)
        use presence_count <- decode.field("presence_count", decode.int)

        let memory_mb = int.to_float(memory) /. 1_024_000.0

        decode.success(ProcessMemoryStats(
          guild_id: guild_id,
          guild_name: guild_name,
          guild_icon: guild_icon,
          memory_mb: memory_mb,
          member_count: member_count,
          session_count: session_count,
          presence_count: presence_count,
        ))
      }

      let decoder = {
        use guilds <- decode.field("guilds", decode.list(guild_decoder))
        decode.success(ProcessMemoryStatsResponse(guilds: guilds))
      }

      case json.parse(resp.body, decoder) {
        Ok(result) -> Ok(result)
        Error(_) -> Error(ServerError)
      }
    }
    Ok(resp) if resp.status == 401 -> Error(Unauthorized)
    Ok(resp) if resp.status == 403 -> {
      let message_decoder = {
        use message <- decode.field("message", decode.string)
        decode.success(message)
      }

      let message = case json.parse(resp.body, message_decoder) {
        Ok(msg) -> msg
        Error(_) ->
          "Missing required permissions. Contact an administrator to request access."
      }

      Error(Forbidden(message))
    }
    Ok(resp) if resp.status == 404 -> Error(NotFound)
    Ok(_resp) -> Error(ServerError)
    Error(_) -> Error(NetworkError)
  }
}

pub fn reload_all_guilds(
  ctx: Context,
  session: Session,
  guild_ids: List(String),
) -> Result(Int, ApiError) {
  let url = ctx.api_endpoint <> "/admin/gateway/reload-all"
  let body =
    json.object([
      #("guild_ids", json.array(guild_ids, json.string)),
    ])
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
        use count <- decode.field("count", decode.int)
        decode.success(count)
      }

      case json.parse(resp.body, decoder) {
        Ok(count) -> Ok(count)
        Error(_) -> Error(ServerError)
      }
    }
    Ok(resp) if resp.status == 401 -> Error(Unauthorized)
    Ok(resp) if resp.status == 403 -> {
      let message_decoder = {
        use message <- decode.field("message", decode.string)
        decode.success(message)
      }

      let message = case json.parse(resp.body, message_decoder) {
        Ok(msg) -> msg
        Error(_) ->
          "Missing required permissions. Contact an administrator to request access."
      }

      Error(Forbidden(message))
    }
    Ok(resp) if resp.status == 404 -> Error(NotFound)
    Ok(_resp) -> Error(ServerError)
    Error(_) -> Error(NetworkError)
  }
}

pub type NodeStats {
  NodeStats(
    status: String,
    sessions: Int,
    guilds: Int,
    presences: Int,
    calls: Int,
    memory_total: Int,
    memory_processes: Int,
    memory_system: Int,
    process_count: Int,
    process_limit: Int,
    uptime_seconds: Int,
  )
}

pub fn get_node_stats(
  ctx: Context,
  session: Session,
) -> Result(NodeStats, ApiError) {
  let url = ctx.api_endpoint <> "/admin/gateway/stats"

  let assert Ok(req) = request.to(url)
  let req =
    req
    |> request.set_method(http.Get)
    |> request.set_header("authorization", "Bearer " <> session.access_token)

  case httpc.send(req) {
    Ok(resp) if resp.status == 200 -> {
      let decoder = {
        use status <- decode.field("status", decode.string)
        use sessions <- decode.field("sessions", decode.int)
        use guilds <- decode.field("guilds", decode.int)
        use presences <- decode.field("presences", decode.int)
        use calls <- decode.field("calls", decode.int)
        use memory <- decode.field("memory", {
          use total <- decode.field("total", decode.int)
          use processes <- decode.field("processes", decode.int)
          use system <- decode.field("system", decode.int)
          decode.success(#(total, processes, system))
        })
        use process_count <- decode.field("process_count", decode.int)
        use process_limit <- decode.field("process_limit", decode.int)
        use uptime_seconds <- decode.field("uptime_seconds", decode.int)

        let #(mem_total, mem_proc, mem_sys) = memory

        decode.success(NodeStats(
          status: status,
          sessions: sessions,
          guilds: guilds,
          presences: presences,
          calls: calls,
          memory_total: mem_total,
          memory_processes: mem_proc,
          memory_system: mem_sys,
          process_count: process_count,
          process_limit: process_limit,
          uptime_seconds: uptime_seconds,
        ))
      }

      case json.parse(resp.body, decoder) {
        Ok(result) -> Ok(result)
        Error(_) -> Error(ServerError)
      }
    }
    Ok(resp) if resp.status == 401 -> Error(Unauthorized)
    Ok(resp) if resp.status == 403 -> Error(Forbidden("Forbidden"))
    Ok(resp) if resp.status == 404 -> Error(NotFound)
    Ok(_resp) -> Error(ServerError)
    Error(_) -> Error(NetworkError)
  }
}

pub type CpuStats {
  CpuStats(
    count: Int,
    usage: Float,
    load_avg: List(Float),
    model: String,
  )
}

pub type MemoryStats {
  MemoryStats(
    total: Int,
    free: Int,
    used: Int,
    usage_percentage: Int,
  )
}

pub type DiskInfo {
  DiskInfo(
    total: Int,
    used: Int,
    available: Int,
    usage_percentage: Int,
  )
}

pub type OsInfo {
  OsInfo(
    platform: String,
    release: String,
    os_type: String,
    arch: String,
  )
}

pub type OnlineUser {
  OnlineUser(
    id: String,
    username: String,
    display_name: option.Option(String),
    avatar: option.Option(String),
  )
}

pub type UsersInfo {
  UsersInfo(
    online: Int,
    total: Int,
    list: List(OnlineUser),
  )
}

pub type SystemStats {
  SystemStats(
    cpu: CpuStats,
    memory: MemoryStats,
    disk: option.Option(DiskInfo),
    uptime: Int,
    connections: Int,
    presences: Int,
    guilds: Int,
    calls: Int,
    os_info: OsInfo,
    node_version: String,
    timestamp: String,
    users: UsersInfo,
  )
}

pub fn get_system_stats(
  ctx: Context,
  session: Session,
) -> Result(SystemStats, ApiError) {
  let url = ctx.api_endpoint <> "/admin/system/stats"

  let assert Ok(req) = request.to(url)
  let req =
    req
    |> request.set_method(http.Get)
    |> request.set_header("authorization", "Bearer " <> session.access_token)

  case httpc.send(req) {
    Ok(resp) if resp.status == 200 -> {
      let cpu_decoder = {
        use count <- decode.field("count", decode.int)
        use usage <- decode.field("usage", float_or_int_decoder())
        use load_avg <- decode.field("loadAvg", decode.list(float_or_int_decoder()))
        use model <- decode.field("model", decode.string)
        decode.success(CpuStats(
          count: count,
          usage: usage,
          load_avg: load_avg,
          model: model,
        ))
      }

      let memory_decoder = {
        use total <- decode.field("total", decode.int)
        use free <- decode.field("free", decode.int)
        use used <- decode.field("used", decode.int)
        use usage_percentage <- decode.field("usagePercentage", decode.int)
        decode.success(MemoryStats(
          total: total,
          free: free,
          used: used,
          usage_percentage: usage_percentage,
        ))
      }

      let disk_info_decoder = {
        use total <- decode.field("total", decode.int)
        use used <- decode.field("used", decode.int)
        use available <- decode.field("available", decode.int)
        use usage_percentage <- decode.field("usagePercentage", decode.int)
        decode.success(DiskInfo(
          total: total,
          used: used,
          available: available,
          usage_percentage: usage_percentage,
        ))
      }

      let os_decoder = {
        use platform <- decode.field("platform", decode.string)
        use release <- decode.field("release", decode.string)
        use os_type <- decode.field("type", decode.string)
        use arch <- decode.field("arch", decode.string)
        decode.success(OsInfo(
          platform: platform,
          release: release,
          os_type: os_type,
          arch: arch,
        ))
      }

      let online_user_decoder = {
        use id <- decode.field("id", decode.string)
        use username <- decode.field("username", decode.string)
        use display_name <- decode.field(
          "displayName",
          decode.optional(decode.string),
        )
        use avatar_val <- decode.field("avatar", decode.optional(decode.string))
        decode.success(OnlineUser(
          id: id,
          username: username,
          display_name: display_name,
          avatar: avatar_val,
        ))
      }

      let users_decoder = {
        use online <- decode.field("online", decode.int)
        use total <- decode.field("total", decode.int)
        use user_list <- decode.field(
          "list",
          decode.list(online_user_decoder),
        )
        decode.success(UsersInfo(online: online, total: total, list: user_list))
      }

      let decoder = {
        use cpu <- decode.field("cpu", cpu_decoder)
        use memory <- decode.field("memory", memory_decoder)
        use disk <- decode.optional_field(
          "disk",
          option.None,
          {
            use root <- decode.optional_field(
              "root",
              option.None,
              disk_info_decoder |> decode.map(option.Some),
            )
            decode.success(root)
          },
        )
        use uptime <- decode.field("uptime", decode.int)
        use connections <- decode.field("connections", decode.int)
        use presences_val <- decode.field("presences", decode.int)
        use guilds_val <- decode.field("guilds", decode.int)
        use calls_val <- decode.field("calls", decode.int)
        use os_info <- decode.field("os", os_decoder)
        use node_version <- decode.field("nodeVersion", decode.string)
        use timestamp <- decode.field("timestamp", decode.string)
        use users <- decode.field("users", users_decoder)
        decode.success(SystemStats(
          cpu: cpu,
          memory: memory,
          disk: disk,
          uptime: uptime,
          connections: connections,
          presences: presences_val,
          guilds: guilds_val,
          calls: calls_val,
          os_info: os_info,
          node_version: node_version,
          timestamp: timestamp,
          users: users,
        ))
      }

      case json.parse(resp.body, decoder) {
        Ok(result) -> Ok(result)
        Error(_) -> Error(ServerError)
      }
    }
    Ok(resp) if resp.status == 401 -> Error(Unauthorized)
    Ok(resp) if resp.status == 403 -> {
      let message_decoder = {
        use message <- decode.field("message", decode.string)
        decode.success(message)
      }

      let message = case json.parse(resp.body, message_decoder) {
        Ok(msg) -> msg
        Error(_) ->
          "Missing required permissions. Contact an administrator to request access."
      }

      Error(Forbidden(message))
    }
    Ok(resp) if resp.status == 404 -> Error(NotFound)
    Ok(_resp) -> Error(ServerError)
    Error(_) -> Error(NetworkError)
  }
}

fn float_or_int_decoder() -> decode.Decoder(Float) {
  decode.one_of(decode.float, [
    decode.int |> decode.map(int.to_float),
  ])
}
