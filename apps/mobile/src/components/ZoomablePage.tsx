import { useEffect } from 'react';
import { StyleSheet } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

import { Colors } from '@/constants/theme';
import { MediaImage } from './ui';

const MAX_SCALE = 4;
const DOUBLE_TAP_SCALE = 2.5;
/** Quanto o dedo anda antes de o arrasto decidir se é horizontal (virar) ou não. */
const SLOP = 12;

/**
 * Uma página do leitor: pinça, toque duplo para ampliar/voltar, arrastar a
 * página ampliada — e o arrasto de virar página.
 *
 * A virada de página mora aqui, e não na rolagem da lista, de propósito. A
 * rolagem nativa não conversa com os gestos: dois dedos se afastando na
 * horizontal faziam a lista virar a página antes de a pinça ser reconhecida.
 * Aqui o arrasto só aceita UM dedo — o segundo cancela o arrasto e a pinça
 * assume — e a lista (com a rolagem por toque desligada) só anda quando este
 * gesto decide virar, via `onTurn`.
 */
export function ZoomablePage({
  width,
  height,
  url,
  localUri,
  resetKey,
  canPrev,
  canNext,
  onTap,
  onTurn,
}: {
  width: number;
  height: number;
  url: string | null;
  localUri: string | null;
  /** Muda quando a página sai de vista: a próxima visita começa sem zoom. */
  resetKey: boolean;
  canPrev: boolean;
  canNext: boolean;
  onTap: (x: number) => void;
  /** -1 volta uma página, 1 avança. */
  onTurn: (direction: -1 | 1) => void;
}) {
  const scale = useSharedValue(1);
  const savedScale = useSharedValue(1);
  const x = useSharedValue(0);
  const y = useSharedValue(0);
  const savedX = useSharedValue(0);
  const savedY = useSharedValue(0);
  /** Deslocamento da página inteira enquanto o dedo arrasta para virar. */
  const swipe = useSharedValue(0);
  const startX = useSharedValue(0);
  const startY = useSharedValue(0);
  /**
   * Esta sequência de toques (do primeiro dedo encostar ao último sair) teve
   * dois dedos? Se teve, era pinça — e nenhum toque dela vira comando.
   */
  const hadTwoFingers = useSharedValue(false);

  useEffect(() => {
    scale.set(1);
    savedScale.set(1);
    x.set(0);
    y.set(0);
    savedX.set(0);
    savedY.set(0);
    swipe.set(0);
  }, [resetKey, scale, savedScale, x, y, savedX, savedY, swipe]);

  const zoomed = () => {
    'worklet';
    return savedScale.get() > 1.01 || scale.get() > 1.01;
  };

  /** Não deixa a imagem sair da tela: o deslocamento máximo cresce com o zoom. */
  const clamp = (value: number, size: number, currentScale: number) => {
    'worklet';
    const limit = (size * (currentScale - 1)) / 2;
    return Math.min(limit, Math.max(-limit, value));
  };

  const pinch = Gesture.Pinch()
    .onTouchesDown((event) => {
      // Primeiro dedo de um toque novo zera a marca; o segundo a acende.
      hadTwoFingers.set(event.numberOfTouches >= 2);
    })
    .onStart(() => {
      hadTwoFingers.set(true);
      // Se um arrasto de virar já tinha começado, a página volta para o lugar.
      swipe.set(withTiming(0));
    })
    .onUpdate((event) => {
      scale.set(Math.min(MAX_SCALE, Math.max(1, savedScale.get() * event.scale)));
    })
    .onEnd(() => {
      // Quase sem zoom vira sem zoom: senão a página fica 1% ampliada.
      const target = scale.get() <= 1.01 ? 1 : scale.get();
      const targetX = clamp(x.get(), width, target);
      const targetY = clamp(y.get(), height, target);
      scale.set(withTiming(target));
      x.set(withTiming(targetX));
      y.set(withTiming(targetY));
      savedScale.set(target);
      savedX.set(targetX);
      savedY.set(targetY);
    });

  const pan = Gesture.Pan()
    .maxPointers(1)
    .manualActivation(true)
    .onTouchesDown((event) => {
      const touch = event.allTouches[0];
      if (touch) {
        startX.set(touch.absoluteX);
        startY.set(touch.absoluteY);
      }
      if (event.numberOfTouches >= 2) hadTwoFingers.set(true);
    })
    .onTouchesMove((event, manager) => {
      // Segundo dedo na tela: é pinça, nunca virada de página.
      if (event.numberOfTouches >= 2) {
        hadTwoFingers.set(true);
        manager.fail();
        return;
      }
      if (zoomed()) {
        manager.activate();
        return;
      }
      const touch = event.allTouches[0];
      if (!touch) return;
      const dx = touch.absoluteX - startX.get();
      const dy = touch.absoluteY - startY.get();
      if (Math.abs(dx) > SLOP && Math.abs(dx) > Math.abs(dy)) manager.activate();
      else if (Math.abs(dy) > SLOP) manager.fail();
    })
    .onUpdate((event) => {
      if (zoomed()) {
        x.set(clamp(savedX.get() + event.translationX, width, scale.get()));
        y.set(clamp(savedY.get() + event.translationY, height, scale.get()));
        return;
      }
      // Sem página para onde ir, o arrasto resiste em vez de seguir o dedo.
      const blocked = (event.translationX < 0 && !canNext) || (event.translationX > 0 && !canPrev);
      swipe.set(blocked ? event.translationX * 0.25 : event.translationX);
    })
    .onEnd((event, success) => {
      if (zoomed()) {
        savedX.set(x.get());
        savedY.set(y.get());
        return;
      }
      // Arrasto cancelado pelo segundo dedo não vira página: só volta para o lugar.
      if (!success || hadTwoFingers.get()) {
        swipe.set(withTiming(0, { duration: 200 }));
        return;
      }
      const next = event.translationX < -width * 0.2 || event.velocityX < -600;
      const prev = event.translationX > width * 0.2 || event.velocityX > 600;
      if (next && canNext) scheduleOnRN(onTurn, 1);
      else if (prev && canPrev) scheduleOnRN(onTurn, -1);
      swipe.set(withTiming(0, { duration: 200 }));
    });

  /** Toque no fim de uma pinça é o dedo saindo da tela, não um comando. */
  const afterPinch = () => {
    'worklet';
    return hadTwoFingers.get();
  };

  const doubleTap = Gesture.Tap()
    .numberOfTaps(2)
    .maxDistance(SLOP)
    .onEnd((event) => {
      if (afterPinch()) return;
      const zoomIn = savedScale.get() <= 1.01;
      const target = zoomIn ? DOUBLE_TAP_SCALE : 1;
      // Amplia em direção ao ponto tocado, não ao centro.
      const targetX = zoomIn ? clamp((width / 2 - event.x) * (target - 1), width, target) : 0;
      const targetY = zoomIn ? clamp((height / 2 - event.y) * (target - 1), height, target) : 0;
      scale.set(withTiming(target));
      x.set(withTiming(targetX));
      y.set(withTiming(targetY));
      savedScale.set(target);
      savedX.set(targetX);
      savedY.set(targetY);
    });

  const singleTap = Gesture.Tap()
    .maxDistance(SLOP)
    .onEnd((event) => {
      if (afterPinch()) return;
      scheduleOnRN(onTap, event.x);
    });

  const gesture = Gesture.Simultaneous(pinch, pan, Gesture.Exclusive(doubleTap, singleTap));

  const page = useAnimatedStyle(() => ({ transform: [{ translateX: swipe.get() }] }));
  const image = useAnimatedStyle(() => ({
    transform: [{ translateX: x.get() }, { translateY: y.get() }, { scale: scale.get() }],
  }));

  return (
    <GestureDetector gesture={gesture}>
      <Animated.View style={[{ width, height, overflow: 'hidden' }, styles.page]}>
        <Animated.View style={[{ width, height }, page]}>
          <Animated.View style={[{ width, height }, image]}>
            <MediaImage
              url={url}
              localUri={localUri}
              contentFit="contain"
              style={{ width, height, backgroundColor: Colors.ink950 }}
            />
          </Animated.View>
        </Animated.View>
      </Animated.View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  page: { backgroundColor: Colors.ink950 },
});
