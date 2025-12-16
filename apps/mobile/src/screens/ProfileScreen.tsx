// Profile Screen
import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  Alert,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import Icon from 'react-native-vector-icons/Ionicons';

import { useAuthStore, useFavoritesStore } from '../store';
import { useBiometrics } from '../hooks/useBiometrics';

interface MenuItemProps {
  icon: string;
  title: string;
  subtitle?: string;
  onPress: () => void;
  showBadge?: number;
  color?: string;
}

const MenuItem: React.FC<MenuItemProps> = ({
  icon,
  title,
  subtitle,
  onPress,
  showBadge,
  color = '#333',
}) => (
  <TouchableOpacity style={styles.menuItem} onPress={onPress}>
    <View style={[styles.menuIconContainer, { backgroundColor: `${color}15` }]}>
      <Icon name={icon} size={22} color={color} />
    </View>
    <View style={styles.menuContent}>
      <Text style={styles.menuTitle}>{title}</Text>
      {subtitle && <Text style={styles.menuSubtitle}>{subtitle}</Text>}
    </View>
    <View style={styles.menuRight}>
      {showBadge !== undefined && showBadge > 0 && (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{showBadge}</Text>
        </View>
      )}
      <Icon name="chevron-forward" size={20} color="#ccc" />
    </View>
  </TouchableOpacity>
);

export const ProfileScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const { user, logout } = useAuthStore();
  const { favorites } = useFavoritesStore();
  const { getBiometryTypeName, isEnabled: biometricsEnabled } = useBiometrics();

  const handleLogout = () => {
    Alert.alert(
      'Вийти з акаунту?',
      'Ви впевнені, що хочете вийти?',
      [
        { text: 'Скасувати', style: 'cancel' },
        {
          text: 'Вийти',
          style: 'destructive',
          onPress: async () => {
            await logout();
          },
        },
      ]
    );
  };

  return (
    <ScrollView style={styles.container}>
      {/* Profile Header */}
      <View style={styles.header}>
        <View style={styles.avatarContainer}>
          {user?.avatar ? (
            <Image source={{ uri: user.avatar }} style={styles.avatar} />
          ) : (
            <View style={styles.avatarPlaceholder}>
              <Text style={styles.avatarText}>
                {user?.firstName?.[0]}
                {user?.lastName?.[0]}
              </Text>
            </View>
          )}
        </View>
        <Text style={styles.userName}>
          {user?.firstName} {user?.lastName}
        </Text>
        <Text style={styles.userEmail}>{user?.email}</Text>

        {biometricsEnabled && (
          <View style={styles.biometricBadge}>
            <Icon name="finger-print" size={14} color="#4CAF50" />
            <Text style={styles.biometricText}>{getBiometryTypeName()}</Text>
          </View>
        )}
      </View>

      {/* Quick Stats */}
      <View style={styles.statsContainer}>
        <View style={styles.statItem}>
          <Text style={styles.statValue}>12</Text>
          <Text style={styles.statLabel}>Замовлень</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statItem}>
          <Text style={styles.statValue}>{favorites.length}</Text>
          <Text style={styles.statLabel}>В обраному</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statItem}>
          <Text style={styles.statValue}>500</Text>
          <Text style={styles.statLabel}>Бонусів</Text>
        </View>
      </View>

      {/* Menu Items */}
      <View style={styles.menuSection}>
        <Text style={styles.sectionTitle}>Мої покупки</Text>
        <MenuItem
          icon="receipt-outline"
          title="Мої замовлення"
          subtitle="Історія та статус"
          onPress={() => navigation.navigate('Orders')}
        />
        <MenuItem
          icon="heart-outline"
          title="Обране"
          showBadge={favorites.length}
          onPress={() => navigation.navigate('Favorites')}
          color="#FF6B6B"
        />
        <MenuItem
          icon="star-outline"
          title="Бонусна програма"
          subtitle="500 бонусів"
          onPress={() => {}}
          color="#FFB800"
        />
      </View>

      <View style={styles.menuSection}>
        <Text style={styles.sectionTitle}>Налаштування</Text>
        <MenuItem
          icon="person-outline"
          title="Особисті дані"
          onPress={() => {}}
        />
        <MenuItem
          icon="location-outline"
          title="Адреси доставки"
          onPress={() => {}}
        />
        <MenuItem
          icon="card-outline"
          title="Способи оплати"
          onPress={() => {}}
        />
        <MenuItem
          icon="notifications-outline"
          title="Сповіщення"
          onPress={() => navigation.navigate('Settings')}
        />
        <MenuItem
          icon="settings-outline"
          title="Налаштування"
          onPress={() => navigation.navigate('Settings')}
        />
      </View>

      <View style={styles.menuSection}>
        <Text style={styles.sectionTitle}>Підтримка</Text>
        <MenuItem
          icon="chatbubble-ellipses-outline"
          title="AI Помічник"
          subtitle="Допоможе з питаннями"
          onPress={() => navigation.navigate('AIAssistant')}
          color="#007AFF"
        />
        <MenuItem
          icon="help-circle-outline"
          title="Довідка"
          onPress={() => {}}
        />
        <MenuItem
          icon="document-text-outline"
          title="Правила та умови"
          onPress={() => {}}
        />
      </View>

      {/* Logout Button */}
      <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
        <Icon name="log-out-outline" size={20} color="#FF6B6B" />
        <Text style={styles.logoutText}>Вийти з акаунту</Text>
      </TouchableOpacity>

      <View style={styles.version}>
        <Text style={styles.versionText}>Версія 1.0.0</Text>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  header: {
    backgroundColor: '#fff',
    alignItems: 'center',
    paddingVertical: 24,
    paddingTop: 48,
  },
  avatarContainer: {
    marginBottom: 12,
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
  },
  avatarPlaceholder: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#007AFF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    fontSize: 28,
    fontWeight: '600',
    color: '#fff',
  },
  userName: {
    fontSize: 20,
    fontWeight: '600',
    color: '#333',
  },
  userEmail: {
    fontSize: 14,
    color: '#666',
    marginTop: 4,
  },
  biometricBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E8F5E9',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    marginTop: 12,
    gap: 4,
  },
  biometricText: {
    fontSize: 12,
    color: '#4CAF50',
  },
  statsContainer: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    marginTop: 1,
    paddingVertical: 16,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statValue: {
    fontSize: 20,
    fontWeight: '600',
    color: '#333',
  },
  statLabel: {
    fontSize: 12,
    color: '#666',
    marginTop: 4,
  },
  statDivider: {
    width: 1,
    backgroundColor: '#eee',
  },
  menuSection: {
    backgroundColor: '#fff',
    marginTop: 16,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: '#999',
    textTransform: 'uppercase',
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 8,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f5f5f5',
  },
  menuIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  menuContent: {
    flex: 1,
    marginLeft: 12,
  },
  menuTitle: {
    fontSize: 15,
    color: '#333',
  },
  menuSubtitle: {
    fontSize: 13,
    color: '#999',
    marginTop: 2,
  },
  menuRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  badge: {
    backgroundColor: '#FF6B6B',
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 6,
  },
  badgeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
    marginTop: 16,
    paddingVertical: 16,
    gap: 8,
  },
  logoutText: {
    fontSize: 15,
    color: '#FF6B6B',
    fontWeight: '500',
  },
  version: {
    alignItems: 'center',
    paddingVertical: 24,
  },
  versionText: {
    fontSize: 12,
    color: '#999',
  },
});

export default ProfileScreen;
