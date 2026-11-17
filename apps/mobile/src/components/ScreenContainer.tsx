import React from 'react';
import { Platform, StyleSheet, View, ViewStyle } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors } from '../design-system/tokens';

interface ScreenContainerProps {
  children: React.ReactNode;
  style?: ViewStyle;
}

export function ScreenContainer({ children, style }: ScreenContainerProps) {
  return (
    <SafeAreaView style={styles.root} edges={['top', 'left', 'right']}>
      <View style={[styles.inner, style]}>{children}</View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.background,
    alignItems: Platform.OS === 'web' ? 'center' : 'stretch',
  },
  inner: {
    flex: 1,
    width: '100%',
    maxWidth: Platform.OS === 'web' ? 720 : undefined,
    backgroundColor: colors.background,
  },
});

