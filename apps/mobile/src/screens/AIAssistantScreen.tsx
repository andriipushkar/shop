// AI Assistant Screen - Chat with Shopping Assistant
import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Image,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import Icon from 'react-native-vector-icons/Ionicons';

import { api, ChatMessage, Product } from '../services/api';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  products?: Product[];
  isLoading?: boolean;
}

export const AIAssistantScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      role: 'assistant',
      content: 'Привіт! Я ваш персональний помічник. Допоможу знайти товари, порівняти ціни або відповім на питання про замовлення. Що вас цікавить?',
      timestamp: new Date(),
    },
  ]);
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);

  const flatListRef = useRef<FlatList>(null);

  // Quick suggestions
  const suggestions = [
    'Знайди ноутбук до 30000 грн',
    'Порівняй iPhone 15 та Samsung S24',
    'Які акції зараз діють?',
    'Де моє замовлення?',
  ];

  const scrollToBottom = () => {
    setTimeout(() => {
      flatListRef.current?.scrollToEnd({ animated: true });
    }, 100);
  };

  const sendMessage = useCallback(async (text: string) => {
    if (!text.trim() || isLoading) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: text.trim(),
      timestamp: new Date(),
    };

    const loadingMessage: Message = {
      id: (Date.now() + 1).toString(),
      role: 'assistant',
      content: '',
      timestamp: new Date(),
      isLoading: true,
    };

    setMessages((prev) => [...prev, userMessage, loadingMessage]);
    setInputText('');
    setIsLoading(true);
    scrollToBottom();

    try {
      const response = await api.sendChatMessage({
        message: text.trim(),
        sessionId: sessionId || undefined,
      });

      if (response.sessionId && !sessionId) {
        setSessionId(response.sessionId);
      }

      const assistantMessage: Message = {
        id: (Date.now() + 2).toString(),
        role: 'assistant',
        content: response.response,
        timestamp: new Date(),
        products: response.products,
      };

      setMessages((prev) =>
        prev.filter((m) => !m.isLoading).concat(assistantMessage)
      );
    } catch (error) {
      console.error('Chat error:', error);
      const errorMessage: Message = {
        id: (Date.now() + 2).toString(),
        role: 'assistant',
        content: 'Вибачте, сталася помилка. Спробуйте ще раз.',
        timestamp: new Date(),
      };
      setMessages((prev) =>
        prev.filter((m) => !m.isLoading).concat(errorMessage)
      );
    } finally {
      setIsLoading(false);
      scrollToBottom();
    }
  }, [isLoading, sessionId]);

  const handleSuggestion = (text: string) => {
    sendMessage(text);
  };

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('uk-UA', {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('uk-UA', {
      style: 'currency',
      currency: 'UAH',
      minimumFractionDigits: 0,
    }).format(price);
  };

  const renderProductCard = (product: Product) => (
    <TouchableOpacity
      key={product.id}
      style={styles.productCard}
      onPress={() => navigation.navigate('Product', { productId: product.id })}
    >
      <View style={styles.productImage}>
        {product.images?.[0] ? (
          <Image
            source={{ uri: product.images[0] }}
            style={styles.productImg}
            resizeMode="cover"
          />
        ) : (
          <Icon name="image-outline" size={24} color="#ccc" />
        )}
      </View>
      <View style={styles.productInfo}>
        <Text style={styles.productName} numberOfLines={2}>
          {product.name}
        </Text>
        <Text style={styles.productPrice}>{formatPrice(product.price)}</Text>
      </View>
    </TouchableOpacity>
  );

  const renderMessage = ({ item }: { item: Message }) => {
    const isUser = item.role === 'user';

    if (item.isLoading) {
      return (
        <View style={[styles.messageContainer, styles.assistantMessage]}>
          <View style={styles.avatar}>
            <Icon name="sparkles" size={16} color="#007AFF" />
          </View>
          <View style={styles.messageBubble}>
            <ActivityIndicator size="small" color="#007AFF" />
          </View>
        </View>
      );
    }

    return (
      <View
        style={[
          styles.messageContainer,
          isUser ? styles.userMessage : styles.assistantMessage,
        ]}
      >
        {!isUser && (
          <View style={styles.avatar}>
            <Icon name="sparkles" size={16} color="#007AFF" />
          </View>
        )}
        <View style={styles.messageContent}>
          <View
            style={[
              styles.messageBubble,
              isUser ? styles.userBubble : styles.assistantBubble,
            ]}
          >
            <Text
              style={[
                styles.messageText,
                isUser ? styles.userText : styles.assistantText,
              ]}
            >
              {item.content}
            </Text>
          </View>

          {/* Product recommendations */}
          {item.products && item.products.length > 0 && (
            <View style={styles.productsContainer}>
              <Text style={styles.productsTitle}>Рекомендовані товари:</Text>
              {item.products.map(renderProductCard)}
            </View>
          )}

          <Text style={styles.messageTime}>{formatTime(item.timestamp)}</Text>
        </View>
      </View>
    );
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
    >
      {/* Messages List */}
      <FlatList
        ref={flatListRef}
        data={messages}
        renderItem={renderMessage}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.messagesList}
        onContentSizeChange={scrollToBottom}
        ListHeaderComponent={
          messages.length === 1 ? (
            <View style={styles.suggestionsContainer}>
              <Text style={styles.suggestionsTitle}>Спробуйте запитати:</Text>
              {suggestions.map((suggestion, index) => (
                <TouchableOpacity
                  key={index}
                  style={styles.suggestionChip}
                  onPress={() => handleSuggestion(suggestion)}
                >
                  <Text style={styles.suggestionText}>{suggestion}</Text>
                </TouchableOpacity>
              ))}
            </View>
          ) : null
        }
      />

      {/* Input Area */}
      <View style={styles.inputContainer}>
        <TextInput
          style={styles.input}
          placeholder="Напишіть повідомлення..."
          value={inputText}
          onChangeText={setInputText}
          multiline
          maxLength={1000}
          onSubmitEditing={() => sendMessage(inputText)}
          returnKeyType="send"
        />
        <TouchableOpacity
          style={[
            styles.sendButton,
            (!inputText.trim() || isLoading) && styles.sendButtonDisabled,
          ]}
          onPress={() => sendMessage(inputText)}
          disabled={!inputText.trim() || isLoading}
        >
          <Icon name="send" size={20} color="#fff" />
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  messagesList: {
    padding: 16,
  },
  messageContainer: {
    flexDirection: 'row',
    marginBottom: 16,
  },
  userMessage: {
    justifyContent: 'flex-end',
  },
  assistantMessage: {
    justifyContent: 'flex-start',
  },
  avatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#f0f8ff',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
  },
  messageContent: {
    maxWidth: '75%',
  },
  messageBubble: {
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  userBubble: {
    backgroundColor: '#007AFF',
    borderBottomRightRadius: 4,
  },
  assistantBubble: {
    backgroundColor: '#fff',
    borderBottomLeftRadius: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 1,
  },
  messageText: {
    fontSize: 15,
    lineHeight: 20,
  },
  userText: {
    color: '#fff',
  },
  assistantText: {
    color: '#333',
  },
  messageTime: {
    fontSize: 11,
    color: '#999',
    marginTop: 4,
    alignSelf: 'flex-end',
  },
  productsContainer: {
    marginTop: 12,
  },
  productsTitle: {
    fontSize: 13,
    color: '#666',
    marginBottom: 8,
  },
  productCard: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 8,
    marginBottom: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 1,
  },
  productImage: {
    width: 48,
    height: 48,
    borderRadius: 6,
    backgroundColor: '#f5f5f5',
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  productImg: {
    width: '100%',
    height: '100%',
  },
  productInfo: {
    flex: 1,
    marginLeft: 10,
    justifyContent: 'center',
  },
  productName: {
    fontSize: 13,
    color: '#333',
  },
  productPrice: {
    fontSize: 14,
    fontWeight: '600',
    color: '#007AFF',
    marginTop: 2,
  },
  suggestionsContainer: {
    marginBottom: 16,
  },
  suggestionsTitle: {
    fontSize: 14,
    color: '#666',
    marginBottom: 12,
  },
  suggestionChip: {
    backgroundColor: '#fff',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  suggestionText: {
    fontSize: 14,
    color: '#333',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    padding: 12,
    paddingBottom: Platform.OS === 'ios' ? 24 : 12,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#eee',
  },
  input: {
    flex: 1,
    minHeight: 40,
    maxHeight: 100,
    backgroundColor: '#f5f5f5',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 15,
    marginRight: 8,
  },
  sendButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#007AFF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendButtonDisabled: {
    backgroundColor: '#ccc',
  },
});

export default AIAssistantScreen;
