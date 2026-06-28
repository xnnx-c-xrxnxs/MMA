import { View, ScrollView, StyleSheet, ActivityIndicator } from 'react-native';
import { useLocalSearchParams, Stack } from 'expo-router';
import { Text, Badge, Card, CardHeader, CardTitle, CardContent, Button, Separator } from '@old-st/mobile-ui';
import {
  useProduct,
  useActivateProduct,
  useDeactivateProduct,
  useDiscontinueProduct,
  formatProductStatus,
} from '@old-st/client-common';
import { productStatusVariant } from '../../lib/status-variants';
import { ProductStatusEnum } from '@old-st/contracts/product';

export default function ProductDetailScreen() {
  const { productId } = useLocalSearchParams<{ productId: string }>();
  const { data: product, isLoading } = useProduct(productId);
  const activateMutation = useActivateProduct();
  const deactivateMutation = useDeactivateProduct();
  const discontinueMutation = useDiscontinueProduct();

  if (isLoading || !product) {
    return (
      <>
        <Stack.Screen options={{ title: 'Product Details', headerShown: true }} />
        <View style={styles.loading}>
          <ActivityIndicator size="large" />
        </View>
      </>
    );
  }

  return (
    <>
      <Stack.Screen options={{ title: product.name, headerShown: true }} />
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        <Card>
          <CardHeader>
            <View style={styles.titleRow}>
              <CardTitle>{product.name}</CardTitle>
              <Badge variant={productStatusVariant(product.status)}>{formatProductStatus(product.status)}</Badge>
            </View>
          </CardHeader>
          <CardContent>
            <View style={styles.field}>
              <Text variant="caption">Description</Text>
              <Text>{product.description}</Text>
            </View>
            <Separator style={styles.separator} />
            <View style={styles.row}>
              <View style={styles.field}>
                <Text variant="caption">Price</Text>
                <Text>${(product.price / 100).toFixed(2)}</Text>
              </View>
              <View style={styles.field}>
                <Text variant="caption">Inventory</Text>
                <Text>{product.inventory}</Text>
              </View>
            </View>
            <Separator style={styles.separator} />
            <View style={styles.field}>
              <Text variant="caption">Created</Text>
              <Text>{new Date(product.dateCreated).toLocaleDateString()}</Text>
            </View>
          </CardContent>
        </Card>

        <Card style={styles.actionsCard}>
          <CardHeader>
            <CardTitle>Actions</CardTitle>
          </CardHeader>
          <CardContent>
            <View style={styles.actions}>
              {product.status === ProductStatusEnum.INACTIVE && (
                <Button
                  variant="default"
                  onPress={() => activateMutation.mutate(productId)}
                  loading={activateMutation.isPending}
                >
                  Activate
                </Button>
              )}
              {product.status === ProductStatusEnum.ACTIVE && (
                <>
                  <Button
                    variant="outline"
                    onPress={() => deactivateMutation.mutate(productId)}
                    loading={deactivateMutation.isPending}
                  >
                    Deactivate
                  </Button>
                  <Button
                    variant="destructive"
                    onPress={() => discontinueMutation.mutate(productId)}
                    loading={discontinueMutation.isPending}
                  >
                    Discontinue
                  </Button>
                </>
              )}
            </View>
          </CardContent>
        </Card>
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  content: {
    padding: 16,
    gap: 16,
  },
  loading: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  titleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  row: {
    flexDirection: 'row',
    gap: 32,
  },
  field: {
    gap: 2,
  },
  separator: {
    marginVertical: 12,
  },
  actionsCard: {
    marginTop: 0,
  },
  actions: {
    gap: 8,
  },
});
