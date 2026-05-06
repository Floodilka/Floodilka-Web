%% Copyright (C) 2020-2026 Fluxer Contributors
%% Copyright (C) 2026 Floodilka Contributors
%%
%% This file is part of Floodilka, a fork of Fluxer
%% (https://github.com/fluxerapp/fluxer).
%% Modified by Floodilka Contributors starting March 2026.
%%
%% Floodilka is free software: you can redistribute it and/or modify
%% it under the terms of the GNU Affero General Public License as published by
%% the Free Software Foundation, either version 3 of the License, or
%% (at your option) any later version.
%%
%% Floodilka is distributed in the hope that it will be useful,
%% but WITHOUT ANY WARRANTY; without even the implied warranty of
%% MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
%% GNU Affero General Public License for more details.
%%
%% You should have received a copy of the GNU Affero General Public License
%% along with Floodilka. If not, see <https://www.gnu.org/licenses/>.

-module(cluster_bootstrap).
-behaviour(gen_server).

-export([start_link/0, peers/0]).
-export([init/1, handle_call/3, handle_cast/2, handle_info/2, terminate/2, code_change/3]).

-define(REFRESH_INTERVAL_MS, 30000).
-define(NODE_NAME_PREFIX, "floodilka_gateway").

-record(state, {
    discovery_dns :: string() | undefined,
    last_peers = [] :: [node()]
}).

-spec start_link() -> {ok, pid()} | {error, term()}.
start_link() ->
    gen_server:start_link({local, ?MODULE}, ?MODULE, [], []).

-spec peers() -> [node()].
peers() ->
    nodes().

-spec init([]) -> {ok, #state{}}.
init([]) ->
    process_flag(trap_exit, true),
    DiscoveryDns = read_dns(),
    case DiscoveryDns of
        undefined ->
            logger:notice("[cluster_bootstrap] CLUSTER_DISCOVERY_DNS not set, running standalone"),
            {ok, #state{}};
        Dns ->
            logger:notice("[cluster_bootstrap] discovery DNS=~s, refresh interval=~pms", [Dns, ?REFRESH_INTERVAL_MS]),
            ok = net_kernel:monitor_nodes(true, [{node_type, all}]),
            self() ! refresh,
            {ok, #state{discovery_dns = Dns}}
    end.

-spec handle_call(term(), gen_server:from(), #state{}) -> {reply, term(), #state{}}.
handle_call(_Msg, _From, State) ->
    {reply, ok, State}.

-spec handle_cast(term(), #state{}) -> {noreply, #state{}}.
handle_cast(_Msg, State) ->
    {noreply, State}.

-spec handle_info(term(), #state{}) -> {noreply, #state{}}.
handle_info(refresh, #state{discovery_dns = undefined} = State) ->
    {noreply, State};
handle_info(refresh, #state{discovery_dns = Dns, last_peers = LastPeers} = State) ->
    Peers = discover_peers(Dns),
    NewPeers = Peers -- LastPeers,
    GonePeers = LastPeers -- Peers,
    lists:foreach(fun connect_peer/1, NewPeers),
    lists:foreach(
        fun(N) -> logger:info("[cluster_bootstrap] peer no longer in DNS: ~p", [N]) end,
        GonePeers
    ),
    erlang:send_after(?REFRESH_INTERVAL_MS, self(), refresh),
    {noreply, State#state{last_peers = Peers}};
handle_info({nodeup, Node, _Info}, State) ->
    logger:notice("[cluster_bootstrap] nodeup: ~p (cluster size=~p)", [Node, length(nodes()) + 1]),
    {noreply, State};
handle_info({nodedown, Node, Info}, State) ->
    logger:warning("[cluster_bootstrap] nodedown: ~p reason=~p (cluster size=~p)", [Node, Info, length(nodes()) + 1]),
    {noreply, State};
handle_info(_Msg, State) ->
    {noreply, State}.

-spec terminate(term(), #state{}) -> ok.
terminate(_Reason, _State) ->
    ok.

-spec code_change(term(), #state{}, term()) -> {ok, #state{}}.
code_change(_OldVsn, State, _Extra) ->
    {ok, State}.

%% Internal helpers

-spec read_dns() -> string() | undefined.
read_dns() ->
    case floodilka_gateway_env:get_optional(cluster_discovery_dns) of
        undefined ->
            undefined;
        Bin when is_binary(Bin) ->
            case string:trim(binary_to_list(Bin)) of
                "" -> undefined;
                Str -> Str
            end;
        Str when is_list(Str) ->
            case string:trim(Str) of
                "" -> undefined;
                S -> S
            end
    end.

-spec discover_peers(string()) -> [node()].
discover_peers(Dns) ->
    case inet:gethostbyname(Dns) of
        {ok, {hostent, _Name, _Aliases, inet, _Length, IPs}} ->
            SelfNode = node(),
            AllNodes = lists:map(
                fun(IP) -> list_to_atom(?NODE_NAME_PREFIX ++ "@" ++ inet:ntoa(IP)) end,
                IPs
            ),
            [N || N <- AllNodes, N =/= SelfNode];
        {error, Reason} ->
            logger:warning("[cluster_bootstrap] DNS lookup failed for ~s: ~p", [Dns, Reason]),
            []
    end.

-spec connect_peer(node()) -> ok.
connect_peer(Node) ->
    case net_kernel:connect_node(Node) of
        true ->
            logger:notice("[cluster_bootstrap] connected to ~p", [Node]);
        false ->
            logger:warning("[cluster_bootstrap] failed to connect to ~p (auth/cookie?)", [Node]);
        ignored ->
            logger:warning("[cluster_bootstrap] connect_node ignored (peer not yet up?): ~p", [Node])
    end,
    ok.
