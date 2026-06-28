import { View, ScrollView, StyleSheet, ActivityIndicator } from 'react-native';
import { useLocalSearchParams, Stack } from 'expo-router';
import { Text, Badge, Card, CardHeader, CardTitle, CardContent, Button, Separator } from '@old-st/mobile-ui';
import { useUser, useActivateUser, useDeactivateUser, formatUserStatus } from '@old-st/client-common';
import { userStatusVariant } from '../../lib/status-variants';
import { UserStatusEnum } from '@old-st/contracts/user';

export default function UserDetailScreen() {
  const { userId } = useLocalSearchParams<{ userId: string }>();
  const { data: user, isLoading } = useUser(userId);
  const activateMutation = useActivateUser();
  const deactivateMutation = useDeactivateUser();

  if (isLoading || !user) {
    return (
      <>
        <Stack.Screen options={{ title: 'User Details', headerShown: true }} />
        <View style={styles.loading}>
          <ActivityIndicator size="large" />
        </View>
      </>
    );
  }

  return (
    <>
      <Stack.Screen options={{ title: `${user.firstName} ${user.lastName}`, headerShown: true }} />
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        <Card>
          <CardHeader>
            <View style={styles.titleRow}>
              <CardTitle>{user.firstName} {user.lastName}</CardTitle>
              <Badge variant={userStatusVariant(user.userStatus)}>{formatUserStatus(user.userStatus)}</Badge>
            </View>
          </CardHeader>
          <CardContent>
            <View style={styles.field}>
              <Text variant="caption">Email</Text>
              <Text>{user.email}</Text>
            </View>
            <Separator style={styles.separator} />
            <View style={styles.field}>
              <Text variant="caption">Role</Text>
              <Text>{user.userRole}</Text>
            </View>
            <Separator style={styles.separator} />
            <View style={styles.field}>
              <Text variant="caption">Created</Text>
              <Text>{new Date(user.dateCreated).toLocaleDateString()}</Text>
            </View>
          </CardContent>
        </Card>

        <Card style={styles.actionsCard}>
          <CardHeader>
            <CardTitle>Actions</CardTitle>
          </CardHeader>
          <CardContent>
            <View style={styles.actions}>
              {user.userStatus === UserStatusEnum.PENDING && (
                <Button
                  variant="default"
                  onPress={() => activateMutation.mutate(userId)}
                  loading={activateMutation.isPending}
                >
                  Activate
                </Button>
              )}
              {user.userStatus === UserStatusEnum.ACTIVE && (
                <Button
                  variant="outline"
                  onPress={() => deactivateMutation.mutate(userId)}
                  loading={deactivateMutation.isPending}
                >
                  Deactivate
                </Button>
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
