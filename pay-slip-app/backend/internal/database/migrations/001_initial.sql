-- migrations/001_initial.sql
-- Pay slip metadata is stored in MySQL; only the PDF files are in Firebase Storage.

CREATE TABLE IF NOT EXISTS users (
    id         VARCHAR(255) PRIMARY KEY,
    email      VARCHAR(255) UNIQUE NOT NULL,
    role       ENUM('user', 'admin') NOT NULL DEFAULT 'user',
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Create default admin user if not exists
INSERT IGNORE INTO users (id, email, role)
VALUES ('0', 'admin@example.com', 'admin');

CREATE TABLE IF NOT EXISTS pay_slips (
    id          VARCHAR(255) PRIMARY KEY,
    user_id     VARCHAR(255) NOT NULL,
    user_email  VARCHAR(255) NOT NULL,
    month       INT NOT NULL,
    year        INT NOT NULL,
    file_url    TEXT NOT NULL,
    uploaded_by VARCHAR(255) NOT NULL,
    created_at  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_payslips_user_date (user_id, year DESC, month DESC)
);
