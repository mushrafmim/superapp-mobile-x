-- migrations/002_store_file_path_instead_of_url.sql
ALTER TABLE pay_slips CHANGE COLUMN file_url file_path TEXT NOT NULL;
