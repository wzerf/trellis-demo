import { useState, useEffect, useRef } from 'react';
import type { SkeletonAnimation } from '../Skeleton/types';

interface UseSkeletonAnimationOptions {
  /** 是否激活动画 */
  active?: boolean;

  /** 动画类型 */
  animation?: SkeletonAnimation;

  /** 延迟显示时间（避免闪烁） */
  delay?: number;
}

/**
 * 骨架屏动画控制 Hook
 * 功能：延迟显示 + 动画类名生成 + 性能优化
 */
export const useSkeletonAnimation = ({
  active = true,
  animation = 'wave',
  delay = 0,
}: UseSkeletonAnimationOptions) => {
  // delay <= 0 时立即可见，否则初始为 false，等待 setTimeout 触发
  const [visible, setVisible] = useState(delay <= 0);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // 延迟显示（避免快速加载时的闪烁）
  useEffect(() => {
    if (delay <= 0) {
      // 立即可见：已经通过 useState 初始化处理了
      return;
    }
    const timer = setTimeout(() => {
      setVisible(true);
    }, delay);
    timerRef.current = timer;
    return () => {
      clearTimeout(timer);
    };
  }, [delay]);

  // 清理
  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, []);

  // 生成动画类名
  const animationClass = active && visible ? `animate-${animation}` : '';

  return {
    visible: active && visible,
    animationClass,
  };
};
