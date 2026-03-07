-- Calendar Database Schema v2.0
-- Updated: 2025-11-26
-- Changes:
--   - calendars: start_date, end_date, is_closed 추가
--   - participants: password_hash 추가, 닉네임 unique 제약

-- 1. 사용자 테이블 (Google OAuth)
CREATE TABLE users (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    user_uuid CHAR(36) NOT NULL UNIQUE,
    email VARCHAR(255) NOT NULL UNIQUE,
    oauth_provider ENUM('google', 'kakao') NOT NULL,
    oauth_id VARCHAR(255) NOT NULL,
    nickname VARCHAR(50),
    profile_image_url VARCHAR(500),
    isTermsAgreed BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_login_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    UNIQUE KEY unique_oauth (oauth_provider, oauth_id),
    INDEX idx_email (email),
    INDEX idx_oauth (oauth_provider, oauth_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 2. 캘린더 테이블 (방장이 생성)
CREATE TABLE calendars (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    slug VARCHAR(16) NOT NULL UNIQUE COMMENT '공유 링크용 난수',
    title VARCHAR(100) NOT NULL COMMENT '모임 제목',
    description TEXT COMMENT '모임 설명',
    start_date DATE NOT NULL COMMENT '투표 가능 시작일',
    end_date DATE NOT NULL COMMENT '투표 가능 종료일',
    is_closed BOOLEAN DEFAULT FALSE COMMENT '투표 마감 여부',
    owner_id BIGINT NOT NULL COMMENT '방장 (users.id)',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    expired_at TIMESTAMP NULL COMMENT '캘린더 만료일',

    FOREIGN KEY (owner_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_slug (slug),
    INDEX idx_owner_id (owner_id),
    INDEX idx_date_range (start_date, end_date),
    INDEX idx_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 3. 참가자 테이블 (닉네임 + 비밀번호)
CREATE TABLE participants (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    participant_uuid CHAR(36) NOT NULL UNIQUE,
    user_id BIGINT NULL COMMENT '참가자 사용자 ID (users.id), 비회원일 경우 NULL',
    role ENUM('host', 'guest') DEFAULT 'guest' COMMENT '역할',
    calendar_id BIGINT NOT NULL,
    nickname VARCHAR(20) NOT NULL COMMENT '참가자 닉네임',
    password_hash VARCHAR(255) NULL COMMENT '비밀번호 해시 (bcrypt)',
    color_code VARCHAR(7) DEFAULT '#FF0000' COMMENT 'hex 색상 (모두 빨강)',
    joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (calendar_id) REFERENCES calendars(id) ON DELETE CASCADE,
    UNIQUE KEY unique_calendar_nickname (calendar_id, nickname),
    INDEX idx_calendar_id (calendar_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 4. 날짜 옵션 테이블 (투표 대상 날짜들)
CREATE TABLE date_options (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    calendar_id BIGINT NOT NULL,
    date_value DATE NOT NULL,
    is_enabled BOOLEAN DEFAULT TRUE COMMENT '투표 활성화 여부',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (calendar_id) REFERENCES calendars(id) ON DELETE CASCADE,
    UNIQUE KEY unique_date_per_calendar (calendar_id, date_value),
    INDEX idx_calendar_date (calendar_id, date_value)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 5. 투표 테이블
CREATE TABLE votes (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    participant_id BIGINT NOT NULL,
    date_option_id BIGINT NOT NULL,
    vote_type ENUM('available', 'unavailable', 'maybe') NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    FOREIGN KEY (participant_id) REFERENCES participants(id) ON DELETE CASCADE,
    FOREIGN KEY (date_option_id) REFERENCES date_options(id) ON DELETE CASCADE,
    UNIQUE KEY unique_vote_per_user_date (participant_id, date_option_id),
    INDEX idx_date_option (date_option_id),
    INDEX idx_participant (participant_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
