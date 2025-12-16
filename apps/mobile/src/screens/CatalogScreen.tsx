// Catalog Screen
import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Image,
  Dimensions,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import Icon from 'react-native-vector-icons/Ionicons';

import { api, Product, Category } from '../services/api';
import { useFavoritesStore } from '../store';

const { width } = Dimensions.get('window');
const CARD_WIDTH = (width - 48) / 2;

interface RouteParams {
  categoryId?: string;
}

export const CatalogScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const route = useRoute();
  const params = route.params as RouteParams | undefined;

  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(
    params?.categoryId || null
  );
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  const { toggleFavorite, isFavorite } = useFavoritesStore();

  const loadProducts = useCallback(
    async (pageNum: number = 1, reset: boolean = false) => {
      if (pageNum === 1) {
        setIsLoading(true);
      } else {
        setIsLoadingMore(true);
      }

      try {
        const response = await api.getProducts({
          page: pageNum,
          limit: 20,
          categoryId: selectedCategory || undefined,
          search: searchQuery || undefined,
        });

        if (reset || pageNum === 1) {
          setProducts(response.items);
        } else {
          setProducts((prev) => [...prev, ...response.items]);
        }
        setHasMore(response.items.length === 20);
        setPage(pageNum);
      } catch (error) {
        console.error('Failed to load products:', error);
      } finally {
        setIsLoading(false);
        setIsLoadingMore(false);
      }
    },
    [selectedCategory, searchQuery]
  );

  const loadCategories = async () => {
    try {
      const data = await api.getCategories();
      setCategories(data);
    } catch (error) {
      console.error('Failed to load categories:', error);
    }
  };

  useEffect(() => {
    loadCategories();
  }, []);

  useEffect(() => {
    loadProducts(1, true);
  }, [selectedCategory, searchQuery]);

  const handleLoadMore = () => {
    if (!isLoadingMore && hasMore) {
      loadProducts(page + 1);
    }
  };

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('uk-UA', {
      style: 'currency',
      currency: 'UAH',
      minimumFractionDigits: 0,
    }).format(price);
  };

  const renderProduct = ({ item }: { item: Product }) => (
    <TouchableOpacity
      style={styles.productCard}
      onPress={() => navigation.navigate('Product', { productId: item.id })}
    >
      <View style={styles.productImage}>
        {item.images?.[0] ? (
          <Image
            source={{ uri: item.images[0] }}
            style={styles.productImg}
            resizeMode="cover"
          />
        ) : (
          <Icon name="image-outline" size={48} color="#ccc" />
        )}
        <TouchableOpacity
          style={styles.favoriteButton}
          onPress={() => toggleFavorite(item.id)}
        >
          <Icon
            name={isFavorite(item.id) ? 'heart' : 'heart-outline'}
            size={20}
            color={isFavorite(item.id) ? '#FF6B6B' : '#666'}
          />
        </TouchableOpacity>
      </View>
      <View style={styles.productInfo}>
        <Text style={styles.productName} numberOfLines={2}>
          {item.name}
        </Text>
        <View style={styles.priceRow}>
          <Text style={styles.productPrice}>{formatPrice(item.price)}</Text>
          {item.compareAtPrice && (
            <Text style={styles.oldPrice}>
              {formatPrice(item.compareAtPrice)}
            </Text>
          )}
        </View>
      </View>
    </TouchableOpacity>
  );

  const renderCategory = ({ item }: { item: Category }) => (
    <TouchableOpacity
      style={[
        styles.categoryChip,
        selectedCategory === item.id && styles.categoryChipActive,
      ]}
      onPress={() =>
        setSelectedCategory(selectedCategory === item.id ? null : item.id)
      }
    >
      <Text
        style={[
          styles.categoryChipText,
          selectedCategory === item.id && styles.categoryChipTextActive,
        ]}
      >
        {item.name}
      </Text>
    </TouchableOpacity>
  );

  const renderFooter = () => {
    if (!isLoadingMore) return null;
    return (
      <View style={styles.loadingMore}>
        <ActivityIndicator size="small" color="#007AFF" />
      </View>
    );
  };

  return (
    <View style={styles.container}>
      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <Icon name="search" size={20} color="#999" style={styles.searchIcon} />
        <TextInput
          style={styles.searchInput}
          placeholder="Пошук товарів..."
          value={searchQuery}
          onChangeText={setSearchQuery}
          returnKeyType="search"
        />
        {searchQuery.length > 0 && (
          <TouchableOpacity onPress={() => setSearchQuery('')}>
            <Icon name="close-circle" size={20} color="#999" />
          </TouchableOpacity>
        )}
      </View>

      {/* Categories */}
      <FlatList
        data={categories}
        renderItem={renderCategory}
        keyExtractor={(item) => item.id}
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.categoriesList}
        contentContainerStyle={styles.categoriesContent}
      />

      {/* Products Grid */}
      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#007AFF" />
        </View>
      ) : products.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Icon name="search-outline" size={64} color="#ccc" />
          <Text style={styles.emptyText}>Товарів не знайдено</Text>
        </View>
      ) : (
        <FlatList
          data={products}
          renderItem={renderProduct}
          keyExtractor={(item) => item.id}
          numColumns={2}
          contentContainerStyle={styles.productsList}
          onEndReached={handleLoadMore}
          onEndReachedThreshold={0.5}
          ListFooterComponent={renderFooter}
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    margin: 16,
    marginBottom: 8,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#eee',
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    paddingVertical: 12,
    fontSize: 16,
  },
  categoriesList: {
    maxHeight: 50,
  },
  categoriesContent: {
    paddingHorizontal: 12,
  },
  categoryChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#fff',
    marginHorizontal: 4,
    borderWidth: 1,
    borderColor: '#eee',
  },
  categoryChipActive: {
    backgroundColor: '#007AFF',
    borderColor: '#007AFF',
  },
  categoryChipText: {
    fontSize: 14,
    color: '#333',
  },
  categoryChipTextActive: {
    color: '#fff',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  emptyText: {
    fontSize: 16,
    color: '#999',
    marginTop: 16,
  },
  productsList: {
    padding: 12,
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
    position: 'relative',
  },
  productImg: {
    width: '100%',
    height: '100%',
  },
  favoriteButton: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
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
  loadingMore: {
    paddingVertical: 16,
  },
});

export default CatalogScreen;
