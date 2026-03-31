FROM erlang:27-slim AS build

WORKDIR /usr/src/app

ENV ERL_FLAGS="-noinput"

RUN apt-get update && apt-get install -y --no-install-recommends \
	git \
	curl \
	make \
	gcc \
	g++ \
	libc6-dev \
	ca-certificates \
	&& rm -rf /var/lib/apt/lists/*

RUN curl -fsSL https://github.com/erlang/rebar3/releases/download/3.24.0/rebar3 -o /usr/local/bin/rebar3 && \
	chmod +x /usr/local/bin/rebar3

COPY rebar.config rebar.lock* ./
RUN rebar3 compile --deps_only

COPY . .
RUN cp config/vm.args.template config/vm.args && \
	cp config/sys.config.template config/sys.config && \
	rebar3 as prod release

FROM erlang:27-slim

WORKDIR /opt/floodilka_gateway

RUN apt-get update && apt-get install -y --no-install-recommends \
	ca-certificates \
	curl \
	&& rm -rf /var/lib/apt/lists/*

COPY --from=build /usr/src/app/_build/prod/rel/floodilka_gateway .

RUN useradd -r -s /sbin/nologin -d /opt/floodilka_gateway floodilka && \
	chown -R floodilka:floodilka /opt/floodilka_gateway

USER floodilka

EXPOSE 8080 8081

ENV RELX_REPLACE_OS_VARS=true

ENTRYPOINT ["/opt/floodilka_gateway/bin/floodilka_gateway", "foreground"]
