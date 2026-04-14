import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Modal,
  Linking,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Keyboard,
} from 'react-native';
import { colors } from '../theme';

type Props = {
  visible: boolean;
  onClose: () => void;
  initialLat: number | null;
  initialLng: number | null;
  onApply: (lat: number, lng: number) => void;
};

export function GeoPickerModal({
  visible,
  onClose,
  initialLat,
  initialLng,
  onApply,
}: Props) {
  const [latStr, setLatStr] = useState('');
  const [lngStr, setLngStr] = useState('');

  useEffect(() => {
    if (!visible) return;
    setLatStr(initialLat != null ? String(initialLat) : '');
    setLngStr(initialLng != null ? String(initialLng) : '');
  }, [visible, initialLat, initialLng]);

  function apply() {
    const la = parseFloat(latStr.replace(',', '.'));
    const ln = parseFloat(lngStr.replace(',', '.'));
    if (Number.isFinite(la) && Number.isFinite(ln) && Math.abs(la) <= 90 && Math.abs(ln) <= 180) {
      onApply(la, ln);
      onClose();
    }
  }

  function openOsm() {
    const la = parseFloat(latStr.replace(',', '.'));
    const ln = parseFloat(lngStr.replace(',', '.'));
    if (!Number.isFinite(la) || !Number.isFinite(ln)) return;
    const url = `https://www.openstreetmap.org/?mlat=${la}&mlon=${ln}#map=16/${la}/${ln}`;
    void Linking.openURL(url);
  }

  const Form = (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={styles.scrollContent}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="on-drag"
      onScrollBeginDrag={() => Keyboard.dismiss()}
    >
      <Text style={styles.title}>Координаты (ручной ввод)</Text>
      <Text style={styles.hint}>
        Без встроенной карты в Expo Go — введите широту и долготу или откройте OSM в
        браузере.
      </Text>
      <Text style={styles.label}>Широта (−90…90)</Text>
      <TextInput
        style={styles.input}
        value={latStr}
        onChangeText={setLatStr}
        keyboardType="numbers-and-punctuation"
        placeholder="55.751244"
        placeholderTextColor={colors.subtext}
      />
      <Text style={styles.label}>Долгота (−180…180)</Text>
      <TextInput
        style={styles.input}
        value={lngStr}
        onChangeText={setLngStr}
        keyboardType="numbers-and-punctuation"
        placeholder="37.618423"
        placeholderTextColor={colors.subtext}
      />
      <TouchableOpacity style={styles.btn} onPress={apply}>
        <Text style={styles.btnText}>Сохранить точку</Text>
      </TouchableOpacity>
      <TouchableOpacity style={styles.btnSecondary} onPress={openOsm}>
        <Text style={styles.btnSecondaryText}>Открыть на OpenStreetMap</Text>
      </TouchableOpacity>
      <TouchableOpacity style={styles.btnSecondary} onPress={onClose}>
        <Text style={styles.btnSecondaryText}>Закрыть</Text>
      </TouchableOpacity>
    </ScrollView>
  );

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      {Platform.OS === 'ios' ? (
        <KeyboardAvoidingView behavior="padding" style={styles.wrap}>
          {Form}
        </KeyboardAvoidingView>
      ) : (
        <View style={styles.wrap}>{Form}</View>
      )}
    </Modal>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: colors.bg },
  scroll: { flex: 1 },
  scrollContent: { padding: 20, paddingTop: 48 },
  title: { fontSize: 20, fontWeight: '700', color: colors.text, marginBottom: 8 },
  hint: { fontSize: 14, color: colors.subtext, marginBottom: 20 },
  label: { fontSize: 14, fontWeight: '600', color: colors.text, marginBottom: 6 },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    padding: 12,
    fontSize: 16,
    marginBottom: 16,
    backgroundColor: colors.card,
    color: colors.text,
  },
  btn: {
    backgroundColor: colors.primary,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 12,
  },
  btnText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  btnSecondary: {
    borderWidth: 1,
    borderColor: colors.primary,
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 10,
  },
  btnSecondaryText: { color: colors.primary, fontWeight: '600' },
});
