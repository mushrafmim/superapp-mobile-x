// internal/configs/config.go
package configs

import (
	"log"
	"os"
)

type Config struct {
	App      AppConfig
	DB       DBConfig
	Auth     AuthConfig
	Firebase FirebaseConfig
}

type AppConfig struct {
	Environment string
	Port        string
}

type DBConfig struct {
	Host     string
	Port     string
	User     string
	Password string
	Name     string
}

type AuthConfig struct {
	JwksURL     string
	Environment string
}

type FirebaseConfig struct {
	StorageBucket string
	Credentials   string
}

func Load() *Config {
	env, envExists := os.LookupEnv("ENVIRONMENT")
	if !envExists {
		env = "development"
		log.Println("ENVIRONMENT not set, defaulting to development")
	}

	config := &Config{
		App: AppConfig{
			Environment: env,
			Port:        getEnv("PORT", "8081"),
		},
		DB: DBConfig{
			Host:     os.Getenv("DB_HOST"),
			Port:     os.Getenv("DB_PORT"),
			User:     os.Getenv("DB_USER"),
			Password: os.Getenv("DB_PASSWORD"),
			Name:     os.Getenv("DB_NAME"),
		},
		Auth: AuthConfig{
			JwksURL:     os.Getenv("JWKS_URL"),
			Environment: env,
		},
		Firebase: FirebaseConfig{
			StorageBucket: os.Getenv("FIREBASE_STORAGE_BUCKET"),
			Credentials:   os.Getenv("GOOGLE_APPLICATION_CREDENTIALS"),
		},
	}

	// Validate critical variables
	if config.DB.Host == "" {
		log.Fatal("DB_HOST environment variable not set")
	}
	if config.DB.Port == "" {
		log.Fatal("DB_PORT environment variable not set")
	}
	if config.DB.User == "" {
		log.Fatal("DB_USER environment variable not set")
	}
	if config.DB.Name == "" {
		log.Fatal("DB_NAME environment variable not set")
	}

	if env == "production" {
		if config.Auth.JwksURL == "" {
			log.Fatal("JWKS_URL environment variable not set (required in production)")
		}
		if config.Firebase.StorageBucket == "" {
			log.Fatal("FIREBASE_STORAGE_BUCKET environment variable not set")
		}
	}

	return config
}

func getEnv(key, fallback string) string {
	if value, ok := os.LookupEnv(key); ok {
		return value
	}
	return fallback
}
