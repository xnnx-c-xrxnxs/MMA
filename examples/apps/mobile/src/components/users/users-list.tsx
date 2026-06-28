import { View, FlatList, Pressable, StyleSheet, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { Text, Badge, Card, CardContent, Separator } from '@old-st/mobile-ui';
import { formatUserStatus } from '@old-st/client-common';
import { userStatusVariant } from '../../lib/status-variants';
import type { UserResponse } from '@old-st/contracts/user';

interface UserListItemProps {
  user: UserResponse;
}

function UserListItem({ user }: UserListItemProps) {
  const router = useRouter();
  return (
    <Pressable onPress={() => router.push(`/users/${user.userId}`)}>
      <Card style={styles.card}>
        <CardContent style={styles.cardContent}>
          <View style={styles.row}>
            <View style={styles.info}>
              <Text variant="subheading">{user.firstName} {user.lastName}</Text>
              <Text variant="muted">{user.email}</Text>
            </View>
            <View style={styles.badges}>
              <Badge variant={userStatusVariant(user.userStatus)}>{formatUserStatus(user.userStatus)}</Badge>
            </View>
          </View>
          <Separator style={styles.separator} />
          <View style={styles.meta}>
            <Text variant="caption">Role: {user.userRole}</Text>
          </View>
        </CardContent>
      </Card>
    </Pressable>
  );
}

interface UsersListProps {
  users: UserResponse[];
  isLoading: boolean;
  onLoadMore?: () => void;
}

export function UsersList({ users, isLoading, onLoadMore }: UsersListProps) {
  if (isLoading && users.length === 0) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return (
    <FlatList
      data={users}
      keyExtractor={(item) => item.userId}
      renderItem={({ item }) => <UserListItem user={item} />}
      contentContainerStyle={styles.list}
      onEndReached={onLoadMore}
      onEndReachedThreshold={0.5}
      ListEmptyComponent={<Text variant="muted" style={styles.empty}>No users found</Text>}
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
    gap: 2,
  },
  badges: {
    flexDirection: 'row',
    gap: 4,
  },
  separator: {
    marginVertical: 8,
  },
  meta: {
    flexDirection: 'row',
    gap: 12,
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
