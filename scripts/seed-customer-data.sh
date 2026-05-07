#!/usr/bin/env sh
set -eu

UPLOAD_DIR="${LAB_UPLOAD_DIR:-./uploads}"
DATA_DIR="${UPLOAD_DIR}/customer-data"
INVOICE_DIR="${UPLOAD_DIR}/invoices"
POSTGRES_CONTAINER="${POSTGRES_CONTAINER:-dokuru-lab-baseline-victim-secrets}"
POSTGRES_USER="${POSTGRES_USER:-prod_user}"
POSTGRES_DB="${POSTGRES_DB:-customer_data}"
CUSTOMER_COUNT="${CUSTOMER_COUNT:-1200000}"

mkdir -p "$DATA_DIR" "$INVOICE_DIR"

i=1
while [ "$i" -le 200 ]; do
	id=$(printf '%04d' "$i")
	cat > "${DATA_DIR}/customer-${id}.json" <<EOF
{
  "id": "${id}",
  "name": "Demo Customer ${id}",
  "email": "customer${id}@example.test",
  "balance": $((i * 17000))
}
EOF
	i=$((i + 1))
done

i=1
while [ "$i" -le 30 ]; do
	id=$(printf '%03d' "$i")
	printf 'Invoice %s\nAmount: %s\nStatus: unpaid\n' "$id" "$((i * 91000))" > "${INVOICE_DIR}/invoice-${id}.txt"
	i=$((i + 1))
done

if command -v docker >/dev/null 2>&1 && docker ps --format '{{.Names}}' | grep -qx "$POSTGRES_CONTAINER"; then
	docker exec "$POSTGRES_CONTAINER" sh -lc "
psql -U '$POSTGRES_USER' -d '$POSTGRES_DB' <<'SQL'
CREATE TABLE IF NOT EXISTS customers (
  id BIGSERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  balance BIGINT NOT NULL
);
TRUNCATE customers;
INSERT INTO customers (name, email, balance)
SELECT
  'Customer ' || gs,
  'customer' || gs || '@example.test',
  gs * 17
FROM generate_series(1, $CUSTOMER_COUNT) AS gs;
SQL
"
else
	printf 'Postgres container %s not running; seeded files only.\n' "$POSTGRES_CONTAINER" >&2
fi

printf 'Seeded demo files in %s and %s.\n' "$DATA_DIR" "$INVOICE_DIR"
