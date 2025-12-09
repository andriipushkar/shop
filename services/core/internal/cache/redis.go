package cache

import (
	"context"
	"encoding/json"
	"time"

	"github.com/redis/go-redis/v9"
)

const (
	ProductsListKey    = "products:all"
	CategoriesListKey  = "categories:all"
	ProductKeyPrefix   = "product:"
	CategoryKeyPrefix  = "category:"

	DefaultTTL         = 5 * time.Minute
	ProductTTL         = 10 * time.Minute
	ListTTL            = 2 * time.Minute
)

type RedisCache struct {
	client *redis.Client
}

func NewRedisCache(addr string) (*RedisCache, error) {
	client := redis.NewClient(&redis.Options{
		Addr:     addr,
		Password: "",
		DB:       0,
	})

	// Test connection
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	if err := client.Ping(ctx).Err(); err != nil {
		return nil, err
	}

	return &RedisCache{client: client}, nil
}

// Set stores a value in cache with TTL
func (c *RedisCache) Set(ctx context.Context, key string, value interface{}, ttl time.Duration) error {
	data, err := json.Marshal(value)
	if err != nil {
		return err
	}
	return c.client.Set(ctx, key, data, ttl).Err()
}

// Get retrieves a value from cache
func (c *RedisCache) Get(ctx context.Context, key string, dest interface{}) error {
	data, err := c.client.Get(ctx, key).Bytes()
	if err != nil {
		return err
	}
	return json.Unmarshal(data, dest)
}

// Delete removes a key from cache
func (c *RedisCache) Delete(ctx context.Context, keys ...string) error {
	if len(keys) == 0 {
		return nil
	}
	return c.client.Del(ctx, keys...).Err()
}

// DeletePattern removes all keys matching a pattern
func (c *RedisCache) DeletePattern(ctx context.Context, pattern string) error {
	iter := c.client.Scan(ctx, 0, pattern, 100).Iterator()
	var keys []string
	for iter.Next(ctx) {
		keys = append(keys, iter.Val())
	}
	if err := iter.Err(); err != nil {
		return err
	}
	if len(keys) > 0 {
		return c.client.Del(ctx, keys...).Err()
	}
	return nil
}

// Exists checks if a key exists
func (c *RedisCache) Exists(ctx context.Context, key string) bool {
	result, err := c.client.Exists(ctx, key).Result()
	return err == nil && result > 0
}

// InvalidateProducts clears all product caches
func (c *RedisCache) InvalidateProducts(ctx context.Context) error {
	// Delete products list
	if err := c.Delete(ctx, ProductsListKey); err != nil {
		return err
	}
	// Delete individual product caches
	return c.DeletePattern(ctx, ProductKeyPrefix+"*")
}

// InvalidateCategories clears all category caches
func (c *RedisCache) InvalidateCategories(ctx context.Context) error {
	if err := c.Delete(ctx, CategoriesListKey); err != nil {
		return err
	}
	return c.DeletePattern(ctx, CategoryKeyPrefix+"*")
}

// InvalidateProduct clears cache for a specific product
func (c *RedisCache) InvalidateProduct(ctx context.Context, productID string) error {
	return c.Delete(ctx, ProductsListKey, ProductKeyPrefix+productID)
}

// InvalidateCategory clears cache for a specific category
func (c *RedisCache) InvalidateCategory(ctx context.Context, categoryID string) error {
	return c.Delete(ctx, CategoriesListKey, CategoryKeyPrefix+categoryID)
}

// Close closes the Redis connection
func (c *RedisCache) Close() error {
	return c.client.Close()
}

// Ping checks Redis connection
func (c *RedisCache) Ping(ctx context.Context) error {
	return c.client.Ping(ctx).Err()
}
