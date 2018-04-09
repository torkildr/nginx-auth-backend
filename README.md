# Nginx Auth Backend

This backend is designed as a docker container, designed to run along side a proxy companion.

The proxy companion is, in turn, designed to run behind [nginx-proxy](https://github.com/jwilder/nginx-proxy/),
so that we don't need to do too much certificate handling.

In theory, there shouldn't be too much stopping you from running this directly as the nginx-proxy-instance.

# Authentication Flow

                     Nginx Auth Proxy    Nginx Auth Backend    Foo-app    Google Authentication

                             |                     |              |                  |
GET https://foo.example.com  |                     |              |                  |
+--------------------------> |                     |              |                  |
                             |                     |              |                  |
                             | 1. Check Auth       |              |                  |
                             | +-----------------> |              |                  |
                             |                     |              |                  |
                             |                     |              |                  |
                             |                     | 2. Auth with 3rd party          |
                             |                     | +------------+----------------> |
                             |                     |              |                  |
                             |                     |              |                  |
                             |                     | 3. POST http://auth.example.com |
                             | <----------------------------------+----------------+ |
                             | +-----------------> |              |                  |
                             |                     |              |                  |
                             |                     |              |                  |
                             | 4. Auth OK/Fail     |              |                  |
                             | <-----------------+ |              |                  |
                             |                     |              |                  |
                             |                     |              |                  |
                             | 5. Reproxy to actual|app backend   |                  |
                             | +--------------------------------> |                  |
                             |                     |              |                  |
                             +                     +              +                  +

## Unauthenticated calls

When calling `foo.example.com` for the first time, the auth backend will redirect the user
to authenticate with the 3rd party backend. When this authentication completes, the auth
backend will authorize the user, and create a session cookie.

## Authenticated calls

On subsequent calls, the auth backend will authenticate the session. If a valid session
exists, step 2 and 3 will be skipped, and authorization will happen directly.

# Docker container layout

The nginx auth proxy can either be directly exposed, or consumed through a reverse proxy. This depends on
wether you would like to authenticate all endpoints, or just a subset.

By using the proposed `docker compose` configuration, only authenticated endpoints will be externally.
This is a simple way to make sure that you don't forget to put authentication on certain endpoints.

## Example docker compose configuration

```YAML
auth-backend:
  restart: always
  image: torkildr/nginx-auth-backend
  container_name: auth-backend
  expose:
    - "80"
  volumes:
    - "/data/auth/config.yaml:/config.yaml"
    - "/data/auth/sessions:/sessions"
  environment:
    - AUTH_CONFIG=/config.yaml
    - AUTH_DOMAIN_ROOT=example.com
    - AUTH_DOMAIN_BACKEND=auth.example.com
    - AUTH_DOMAIN_MAP={"foo.example.com":"http://other-service"}

auth-proxy:
  restart: always
  image: torkildr/nginx-auth-proxy
  container_name: auth-proxy
  depends_on:
    - nginx
    - auth-backend
  expose:
    - "80"
  environment:
    - VIRTUAL_HOST=auth.example.com,foo.example.com
    - LETSENCRYPT_HOST=auth.example.com,foo.example.com
    - LETSENCRYPT_EMAIL=mail@example.com
    - AUTH_BACKEND=http://auth-backend
```

## Example config.yaml

```YAML
cookie:
  secret: "cookie_secret_here"

google_oauth2:
  client_id: "clientid_here"
  secret: "secrethere"

allowed_email:
  - example@example.org
```

# About

This project is based on this project: https://github.com/antoinerg/nginx_auth_backend. It is organized in the same way, but this is a node rewrite, and better fits my need.

