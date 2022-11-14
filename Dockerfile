FROM buildpack-deps:bullseye AS deno

RUN curl -fsSL https://deno.land/x/install/install.sh | sh
ENV DENO_INSTALL="/root/.deno"
ENV PATH="$DENO_INSTALL/bin:$PATH"

COPY . /src
WORKDIR /src
RUN deno task lume

FROM nginx:1.23.2

COPY --from=deno /src/_site/ /usr/share/nginx/html
