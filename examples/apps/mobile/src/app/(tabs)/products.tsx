import { useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Text, Button } from '@old-st/mobile-ui';
import { useProductsByStatus } from '@old-st/client-common';
import { PRODUCT_STATUSES } from '@old-st/contracts/product';
import { ProductsList } from '../../components/products/products-list';

const statuses = ['ALL', ...PRODUCT_STATUSES];

export default function ProductsScreen() {
  const [selectedStatus, setSelectedStatus] = useState('ALL');
  const queryStatus = selectedStatus === 'ALL' ? PRODUCT_STATUSES[0] : selectedStatus;

  const { data, isLoading } = useProductsByStatus({ status: queryStatus });
  const products = data?.data ?? [];

  return (
    <SafeAreaView edges={['bottom']} style={styles.container}>
      <View style={styles.header}>
        <Text variant="heading">Products</Text>
      </View>
      <View style={styles.filters}>
        {statuses.map((status) => (
          <Button
            key={status}
            variant={selectedStatus === status ? 'default' : 'outline'}
            size="sm"
            onPress={() => setSelectedStatus(status)}
          >
            {status}
          </Button>
        ))}
      </View>
      <ProductsList products={products} isLoading={isLoading} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  header: {
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  filters: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
});
