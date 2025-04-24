# Create the SQLite database file and load schema
sqlite3 ../shareCount.db < schema.sql

# Insert sample data
sqlite3 ../shareCount.db < data.sql