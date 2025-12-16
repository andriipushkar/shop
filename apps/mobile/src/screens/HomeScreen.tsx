// Home Screen
import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  Image,
  Dimensions,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import Icon from 'react-native-vector-icons/Ionicons';

import { api, Product, Category } from '../services/api';

const { width } = Dimensions.get('window');
const CARD_WIDTH = (width - 48) / 2;

export const HomeScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [featuredProducts, setFeaturedProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const loadData = async () => {
    try {
      const [productsRes, categoriesRes] = await Promise.all([
        api.getProducts({ featured: true, limit: 8 }),
        api.getCategories(),
      ]);
      setFeaturedProducts(productsRes.items);
      setCategories(categoriesRes.slice(0, 6));
    } catch (error) {
      console.error('Failed to load home data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const onRefresh = async () => {
    setIsRefreshing(true);
    await loadData();
    setIsRefreshing(false);
  };

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('uk-UA', {
      style: 'currency',
      currency: 'UAH',
      minimumFractionDigits: 0,
    }).format(price);
  };

  return (
    <ScrollView
      style={styles.container}
      refreshControl={
        <RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} />
      }
    >
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.logo}>Shop</Text>
        <View style={styles.headerActions}>
          <TouchableOpacity
            style={styles.headerButton}
            onPress={() => navigation.navigate('Search')}
          >
            <Icon name="search" size={24} color="#333" />
          </TouchableOpacity>
        </View>
      </View>

      {/* AI Features Banner */}
      <View style={styles.aiBanner}>
        <TouchableOpacity
          style={styles.aiCard}
          onPress={() => navigation.navigate('AIAssistant')}
        >
          <View style={styles.aiIconContainer}>
            <Icon name="chatbubble-ellipses" size={28} color="#fff" />
          </View>
          <View style={styles.aiTextContainer}>
            <Text style={styles.aiTitle}>AI Помічник</Text>
            <Text style={styles.aiSubtitle}>Допоможу знайти товар</Text>
          </View>
          <Icon name="chevron-forward" size={20} color="#007AFF" />
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.aiCard}
          onPress={() => navigation.navigate('VisualSearch')}
        >
          <View style={[styles.aiIconContainer, { backgroundColor: '#FF6B6B' }]}>
            <Icon name="camera" size={28} color="#fff" />
          </View>
          <View style={styles.aiTextContainer}>
            <Text style={styles.aiTitle}>Пошук за фото</Text>
            <Text style={styles.aiSubtitle}>Знайти схожі товари</Text>
          </View>
          <Icon name="chevron-forward" size={20} color="#007AFF" />
        </TouchableOpacity>
      </View>

      {/* Categories */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Категорії</Text>
          <TouchableOpacity onPress={() => navigation.navigate('Catalog')}>
            <Text style={styles.seeAll}>Усі</Text>
          </TouchableOpacity>
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          {categories.map((category) => (
            <TouchableOpacity
              key={category.id}
              style={styles.categoryCard}
              onPress={() =>
                navigation.navigate('Catalog', { categoryId: category.id })
              }
            >
              <View style={styles.categoryIcon}>
                <Icon name="folder-outline" size={32} color="#007AFF" />
              </View>
              <Text style={styles.categoryName} numberOfLines={1}>
                {category.name}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* Featured Products */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Популярні товари</Text>
          <TouchableOpacity onPress={() => navigation.navigate('Catalog')}>
            <Text style={styles.seeAll}>Усі</Text>
          </TouchableOpacity>
        </View>
        <View style={styles.productsGrid}>
          {featuredProducts.map((product) => (
            <TouchableOpacity
              key={product.id}
              style={styles.productCard}
              onPress={() =>
                navigation.navigate('Product', { productId: product.id })
              }
            >
              <View style={styles.productImage}>
                {product.images?.[0] ? (
                  <Image
                    source={{ uri: product.images[0] }}
                    style={styles.productImg}
                    resizeMode="cover"
                  />
                ) : (
                  <Icon name="image-outline" size={48} color="#ccc" />
                )}
              </View>
              <View style={styles.productInfo}>
                <Text style={styles.productName} numberOfLines={2}>
                  {product.name}
                </Text>
                <View style={styles.priceRow}>
                  <Text style={styles.productPrice}>
                    {formatPrice(product.price)}
                  </Text>
                  {product.compareAtPrice && (
                    <Text style={styles.oldPrice}>
                      {formatPrice(product.compareAtPrice)}
                    </Text>
                  )}
                </View>
              </View>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Promo Banner */}
      <TouchableOpacity style={styles.promoBanner}>
        <View style={styles.promoContent}>
          <Text style={styles.promoTitle}>Знижки до -50%</Text>
          <Text style={styles.promoSubtitle}>На зимову колекцію</Text>
          <View style={styles.promoButton}>
            <Text style={styles.promoButtonText}>Переглянути</Text>
          </View>
        </View>
      </TouchableOpacity>

      <View style={styles.bottomPadding} />
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    paddingTop: 48,
    backgroundColor: '#fff',
  },
  logo: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#007AFF',
  },
  headerActions: {
    flexDirection: 'row',
    gap: 12,
  },
  headerButton: {
    padding: 8,
  },
  aiBanner: {
    padding: 16,
    gap: 12,
  },
  aiCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  aiIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: '#007AFF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  aiTextContainer: {
    flex: 1,
    marginLeft: 12,
  },
  aiTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  aiSubtitle: {
    fontSize: 13,
    color: '#666',
    marginTop: 2,
  },
  section: {
    paddingVertical: 16,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#333',
  },
  seeAll: {
    fontSize: 14,
    color: '#007AFF',
  },
  categoryCard: {
    alignItems: 'center',
    marginLeft: 16,
    width: 80,
  },
  categoryIcon: {
    width: 64,
    height: 64,
    borderRadius: 16,
    backgroundColor: '#f0f8ff',
    justifyContent: 'center',
    alignItems: 'center',
  },
  categoryName: {
    marginTop: 8,
    fontSize: 12,
    color: '#333',
    textAlign: 'center',
  },
  productsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 12,
  },
  productCard: {
    width: CARD_WIDTH,
    marginHorizontal: 4,
    marginBottom: 16,
    backgroundColor: '#fff',
    borderRadius: 12,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  productImage: {
    height: 140,
    backgroundColor: '#f5f5f5',
    justifyContent: 'center',
    alignItems: 'center',
  },
  productImg: {
    width: '100%',
    height: '100%',
  },
  productInfo: {
    padding: 12,
  },
  productName: {
    fontSize: 14,
    color: '#333',
    marginBottom: 8,
    height: 36,
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  productPrice: {
    fontSize: 16,
    fontWeight: '600',
    color: '#007AFF',
  },
  oldPrice: {
    fontSize: 12,
    color: '#999',
    textDecorationLine: 'line-through',
  },
  promoBanner: {
    margin: 16,
    borderRadius: 16,
    backgroundColor: '#667eea',
    overflow: 'hidden',
  },
  promoContent: {
    padding: 24,
  },
  promoTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
  },
  promoSubtitle: {
    fontSize: 16,
    color: 'rgba(255,255,255,0.9)',
    marginTop: 4,
  },
  promoButton: {
    marginTop: 16,
    backgroundColor: '#fff',
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 8,
    alignSelf: 'flex-start',
  },
  promoButtonText: {
    color: '#667eea',
    fontWeight: '600',
  },
  bottomPadding: {
    height: 24,
  },
});

export default HomeScreen;
