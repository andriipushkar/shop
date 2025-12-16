// Cart Screen
import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Image,
  TextInput,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import Icon from 'react-native-vector-icons/Ionicons';

import { useCartStore } from '../store';
import { CartItem } from '../services/api';

export const CartScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const {
    cart,
    isLoading,
    loadCart,
    updateItem,
    removeItem,
    applyPromo,
    clearError,
    error,
  } = useCartStore();

  const [promoCode, setPromoCode] = useState('');
  const [isApplyingPromo, setIsApplyingPromo] = useState(false);

  useEffect(() => {
    loadCart();
  }, []);

  useEffect(() => {
    if (error) {
      Alert.alert('Помилка', error);
      clearError();
    }
  }, [error]);

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('uk-UA', {
      style: 'currency',
      currency: 'UAH',
      minimumFractionDigits: 0,
    }).format(price);
  };

  const handleQuantityChange = async (item: CartItem, delta: number) => {
    const newQuantity = item.quantity + delta;
    if (newQuantity < 1) {
      Alert.alert(
        'Видалити товар?',
        'Ви впевнені, що хочете видалити цей товар з кошика?',
        [
          { text: 'Скасувати', style: 'cancel' },
          { text: 'Видалити', onPress: () => removeItem(item.id), style: 'destructive' },
        ]
      );
    } else {
      await updateItem(item.id, newQuantity);
    }
  };

  const handleRemoveItem = (item: CartItem) => {
    Alert.alert(
      'Видалити товар?',
      `Видалити "${item.product.name}" з кошика?`,
      [
        { text: 'Скасувати', style: 'cancel' },
        { text: 'Видалити', onPress: () => removeItem(item.id), style: 'destructive' },
      ]
    );
  };

  const handleApplyPromo = async () => {
    if (!promoCode.trim()) return;

    setIsApplyingPromo(true);
    try {
      await applyPromo(promoCode.trim());
      Alert.alert('Успіх', 'Промокод застосовано!');
      setPromoCode('');
    } catch {
      // Error is handled by store
    } finally {
      setIsApplyingPromo(false);
    }
  };

  const handleCheckout = () => {
    if (!cart?.items?.length) {
      Alert.alert('Кошик порожній', 'Додайте товари до кошика');
      return;
    }
    navigation.navigate('Checkout');
  };

  const renderCartItem = ({ item }: { item: CartItem }) => (
    <View style={styles.cartItem}>
      <View style={styles.itemImage}>
        {item.product.images?.[0] ? (
          <Image
            source={{ uri: item.product.images[0] }}
            style={styles.image}
            resizeMode="cover"
          />
        ) : (
          <Icon name="image-outline" size={32} color="#ccc" />
        )}
      </View>

      <View style={styles.itemInfo}>
        <Text style={styles.itemName} numberOfLines={2}>
          {item.product.name}
        </Text>
        <Text style={styles.itemPrice}>{formatPrice(item.price)}</Text>

        <View style={styles.quantityContainer}>
          <TouchableOpacity
            style={styles.quantityButton}
            onPress={() => handleQuantityChange(item, -1)}
          >
            <Icon name="remove" size={18} color="#333" />
          </TouchableOpacity>
          <Text style={styles.quantity}>{item.quantity}</Text>
          <TouchableOpacity
            style={styles.quantityButton}
            onPress={() => handleQuantityChange(item, 1)}
          >
            <Icon name="add" size={18} color="#333" />
          </TouchableOpacity>
        </View>
      </View>

      <TouchableOpacity
        style={styles.removeButton}
        onPress={() => handleRemoveItem(item)}
      >
        <Icon name="trash-outline" size={20} color="#FF6B6B" />
      </TouchableOpacity>
    </View>
  );

  if (isLoading && !cart) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#007AFF" />
      </View>
    );
  }

  if (!cart?.items?.length) {
    return (
      <View style={styles.emptyContainer}>
        <Icon name="cart-outline" size={80} color="#ccc" />
        <Text style={styles.emptyTitle}>Кошик порожній</Text>
        <Text style={styles.emptySubtitle}>
          Додайте товари, щоб оформити замовлення
        </Text>
        <TouchableOpacity
          style={styles.shopButton}
          onPress={() => navigation.navigate('Catalog')}
        >
          <Text style={styles.shopButtonText}>Перейти до каталогу</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={cart.items}
        renderItem={renderCartItem}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        ListFooterComponent={
          <View style={styles.promoContainer}>
            <Text style={styles.promoLabel}>Промокод</Text>
            <View style={styles.promoInputContainer}>
              <TextInput
                style={styles.promoInput}
                placeholder="Введіть код"
                value={promoCode}
                onChangeText={setPromoCode}
                autoCapitalize="characters"
              />
              <TouchableOpacity
                style={[
                  styles.promoButton,
                  (!promoCode.trim() || isApplyingPromo) && styles.promoButtonDisabled,
                ]}
                onPress={handleApplyPromo}
                disabled={!promoCode.trim() || isApplyingPromo}
              >
                {isApplyingPromo ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.promoButtonText}>Застосувати</Text>
                )}
              </TouchableOpacity>
            </View>
            {cart.discount && (
              <View style={styles.discountApplied}>
                <Icon name="checkmark-circle" size={16} color="#4CAF50" />
                <Text style={styles.discountText}>
                  Знижка: {formatPrice(cart.discount)}
                </Text>
              </View>
            )}
          </View>
        }
      />

      {/* Summary & Checkout */}
      <View style={styles.summaryContainer}>
        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>Товари ({cart.items.length})</Text>
          <Text style={styles.summaryValue}>{formatPrice(cart.subtotal)}</Text>
        </View>
        {cart.discount && (
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Знижка</Text>
            <Text style={[styles.summaryValue, styles.discountValue]}>
              -{formatPrice(cart.discount)}
            </Text>
          </View>
        )}
        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>Доставка</Text>
          <Text style={styles.summaryValue}>
            {cart.shipping ? formatPrice(cart.shipping) : 'Безкоштовно'}
          </Text>
        </View>
        <View style={[styles.summaryRow, styles.totalRow]}>
          <Text style={styles.totalLabel}>Разом</Text>
          <Text style={styles.totalValue}>{formatPrice(cart.total)}</Text>
        </View>

        <TouchableOpacity
          style={styles.checkoutButton}
          onPress={handleCheckout}
        >
          <Text style={styles.checkoutButtonText}>Оформити замовлення</Text>
          <Icon name="arrow-forward" size={20} color="#fff" />
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
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
  emptyTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#333',
    marginTop: 16,
  },
  emptySubtitle: {
    fontSize: 14,
    color: '#666',
    marginTop: 8,
    textAlign: 'center',
  },
  shopButton: {
    marginTop: 24,
    backgroundColor: '#007AFF',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
  },
  shopButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  listContent: {
    padding: 16,
  },
  cartItem: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  itemImage: {
    width: 80,
    height: 80,
    borderRadius: 8,
    backgroundColor: '#f5f5f5',
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  itemInfo: {
    flex: 1,
    marginLeft: 12,
  },
  itemName: {
    fontSize: 14,
    color: '#333',
    marginBottom: 4,
  },
  itemPrice: {
    fontSize: 16,
    fontWeight: '600',
    color: '#007AFF',
    marginBottom: 8,
  },
  quantityContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  quantityButton: {
    width: 28,
    height: 28,
    borderRadius: 6,
    backgroundColor: '#f0f0f0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  quantity: {
    fontSize: 16,
    fontWeight: '500',
    marginHorizontal: 16,
    minWidth: 24,
    textAlign: 'center',
  },
  removeButton: {
    padding: 8,
  },
  promoContainer: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginTop: 8,
  },
  promoLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#333',
    marginBottom: 8,
  },
  promoInputContainer: {
    flexDirection: 'row',
    gap: 8,
  },
  promoInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#eee',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
  },
  promoButton: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 16,
    borderRadius: 8,
    justifyContent: 'center',
  },
  promoButtonDisabled: {
    backgroundColor: '#ccc',
  },
  promoButtonText: {
    color: '#fff',
    fontWeight: '600',
  },
  discountApplied: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    gap: 4,
  },
  discountText: {
    fontSize: 14,
    color: '#4CAF50',
  },
  summaryContainer: {
    backgroundColor: '#fff',
    padding: 16,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 8,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  summaryLabel: {
    fontSize: 14,
    color: '#666',
  },
  summaryValue: {
    fontSize: 14,
    color: '#333',
  },
  discountValue: {
    color: '#4CAF50',
  },
  totalRow: {
    marginTop: 8,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#eee',
  },
  totalLabel: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
  },
  totalValue: {
    fontSize: 20,
    fontWeight: '700',
    color: '#007AFF',
  },
  checkoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#007AFF',
    paddingVertical: 14,
    borderRadius: 12,
    marginTop: 16,
    gap: 8,
  },
  checkoutButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});

export default CartScreen;
