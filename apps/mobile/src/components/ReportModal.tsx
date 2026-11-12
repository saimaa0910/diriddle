import React, { useState } from 'react';
import {
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { ReportReason } from '@diriddle/shared-types';
import { colors, radii, spacing, typography } from '../design-system/tokens';
import { REPORT_REASONS } from '../types/models';

interface ReportModalProps {
  visible: boolean;
  onClose: () => void;
  onSubmit: (reason: ReportReason, description: string) => Promise<void>;
}

export function ReportModal({ visible, onClose, onSubmit }: ReportModalProps) {
  const [selectedReason, setSelectedReason] = useState<ReportReason>(ReportReason.HARASSMENT);
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleConfirm = async () => {
    setSubmitting(true);
    try {
      await onSubmit(selectedReason, description.trim());
      setDescription('');
      onClose();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
          <Text style={styles.title}>Report Content</Text>
          <Text style={styles.subtitle}>
            Your report is confidential. Our safety team reviews all flags against community guidelines.
          </Text>

          <ScrollView style={styles.list} showsVerticalScrollIndicator={false}>
            {REPORT_REASONS.map((item) => {
              const active = selectedReason === item.reason;
              return (
                <TouchableOpacity
                  key={item.reason}
                  style={[styles.reasonRow, active && styles.reasonRowActive]}
                  onPress={() => setSelectedReason(item.reason)}
                >
                  <Text style={[styles.reasonTitle, active && styles.reasonTitleActive]}>
                    {item.label}
                  </Text>
                  <Text style={styles.reasonDesc}>{item.description}</Text>
                </TouchableOpacity>
              );
            })}

            <TextInput
              style={styles.input}
              placeholder="Optional context for moderators..."
              placeholderTextColor={colors.textMuted}
              value={description}
              onChangeText={setDescription}
              multiline
              maxLength={300}
            />
          </ScrollView>

          <View style={styles.actions}>
            <TouchableOpacity style={styles.cancelBtn} onPress={onClose} disabled={submitting}>
              <Text style={styles.cancelText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.submitBtn, submitting && { opacity: 0.6 }]}
              onPress={handleConfirm}
              disabled={submitting}
            >
              <Text style={styles.submitText}>{submitting ? 'Submitting...' : 'Submit Report'}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: colors.overlay,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.md,
  },
  sheet: {
    width: '100%',
    maxWidth: 480,
    maxHeight: '85%',
    backgroundColor: colors.surface,
    borderRadius: radii.xl,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
  },
  title: {
    ...typography.title,
    color: colors.textPrimary,
    marginBottom: 4,
  },
  subtitle: {
    ...typography.caption,
    color: colors.textSecondary,
    marginBottom: spacing.md,
  },
  list: {
    marginBottom: spacing.md,
  },
  reasonRow: {
    backgroundColor: colors.card,
    borderRadius: radii.sm,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.sm,
    marginBottom: spacing.xs,
  },
  reasonRowActive: {
    backgroundColor: colors.accentMuted,
    borderColor: colors.accent,
  },
  reasonTitle: {
    ...typography.bodyMedium,
    color: colors.textPrimary,
  },
  reasonTitleActive: {
    color: colors.accent,
  },
  reasonDesc: {
    ...typography.micro,
    color: colors.textSecondary,
    fontWeight: '400',
    marginTop: 2,
  },
  input: {
    backgroundColor: colors.card,
    borderRadius: radii.sm,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.sm,
    color: colors.textPrimary,
    minHeight: 72,
    textAlignVertical: 'top',
    marginTop: spacing.xs,
  },
  actions: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  cancelBtn: {
    flex: 1,
    borderRadius: radii.sm,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: 12,
    alignItems: 'center',
  },
  cancelText: {
    ...typography.bodyMedium,
    color: colors.textSecondary,
  },
  submitBtn: {
    flex: 1,
    backgroundColor: colors.accent,
    borderRadius: radii.sm,
    paddingVertical: 12,
    alignItems: 'center',
  },
  submitText: {
    ...typography.bodyMedium,
    color: colors.background,
    fontWeight: '700',
  },
});
