import { View, FlatList, Pressable, StyleSheet, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { Text, Badge, Card, CardContent, Separator } from '@old-st/mobile-ui';
import { formatProductStatus } from '@old-st/client-common';
import { productStatusVariant } from '../../lib/status-variants';
import type { ProductResponse } from '@old-st/contracts/product';

interface ProductListItemProps {
  product: ProductResponse;
}

function ProductListItem({ product }: ProductListItemProps) {
  const router = useRouter();
  return (
    <Pressable onPress={() => router.push(`/products/${product.productId}`)}>
      <Card style={styles.card}>
        <CardContent style={styles.cardContent}>
          <View style={styles.row}>
            <View style={styles.info}>
              <Text variant="subheading">{product.name}</Text>
              <Text variant="muted" numberOfLines={1}>{product.description}</Text>
            </View>
            <Badge variant={productStatusVariant(product.status)}>{formatProductStatus(product.status)}</Badge>
          </View>
          <Separator style={styles.separator} />
          <View style={styles.meta}>
            <Text variant="caption">Price: ${(product.price / 100).toFixed(2)}</Text>
            <Text variant="caption">Stock: {product.inventory}</Text>
          </View>
        </CardContent>
      </Card>
    </Pressable>
  );
}

interface ProductsListProps {
  products: ProductResponse[];
  isLoading: boolean;
  onLoadMore?: () => void;
}

export function ProductsList({ products, isLoading, onLoadMore }: ProductsListProps) {
  if (isLoading && products.length === 0) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return (
    <FlatList
      data={products}
      keyExtractor={(item) => item.productId}
      renderItem={({ item }) => <ProductListItem product={item} />}
      contentContainerStyle={styles.list}
      onEndReached={onLoadMore}
      onEndReachedThreshold={0.5}
      ListEmptyComponent={<Text variant="muted" style={styles.empty}>No products found</Text>}
    />
  );
}

const styles = StyleSheet.create({
  list: {
    padding: 16,
    gap: 8,
  },
  card: {
    marginBottom: 0,
  },
  cardContent: {
    padding: 16,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  info: {
    flex: 1,
    marginRight: 8,
    gap: 2,
  },
  separator: {
    marginVertical: 8,
  },
  meta: {
    flexDirection: 'row',
    gap: 16,
  },
  loading: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  empty: {
    textAlign: 'center',
    padding: 32,
  },
});
