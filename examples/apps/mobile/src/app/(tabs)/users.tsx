import { useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Text, Button } from '@old-st/mobile-ui';
import { useUsersByStatus } from '@old-st/client-common';
import { USER_STATUSES } from '@old-st/contracts/user';
import { UsersList } from '../../components/users/users-list';

const statuses = ['ALL', ...USER_STATUSES];

export default function UsersScreen() {
  const [selectedStatus, setSelectedStatus] = useState('ALL');
  const queryStatus = selectedStatus === 'ALL' ? USER_STATUSES[0] : selectedStatus;

  const { data, isLoading } = useUsersByStatus({ userStatus: queryStatus });
  const users = data?.data ?? [];

  return (
    <SafeAreaView edges={['bottom']} style={styles.container}>
      <View style={styles.header}>
        <Text variant="heading">Users</Text>
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
      <UsersList users={users} isLoading={isLoading} />
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
