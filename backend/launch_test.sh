

PGPASSWORD=testpass psql -h localhost -p 5433 -U testuser -d testdb -f ../docker/db/init/init.sql
cargo test -- --nocapture
