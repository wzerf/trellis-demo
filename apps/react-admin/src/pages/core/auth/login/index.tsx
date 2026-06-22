import React from 'react';
import { useTranslation } from 'react-i18next';
import { Form, Input, Button, Checkbox, App } from 'antd';
import { UserOutlined, LockOutlined } from '@ant-design/icons';
import { useAuthStore } from '@/stores';
import { useNavigate, useSearchParams } from 'react-router-dom';
import '../auth-form.style.less';

const Login: React.FC = () => {
  const { t } = useTranslation('auth');
  const { login, loginLoading } = useAuthStore();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { message } = App.useApp();

  const handleSubmit = async (values: { username: string; password: string; remember?: boolean }) => {
    try {
      await login({
        username: values.username,
        password: values.password,
        grant_type: 'password',
      });

      message.success(t('loginSuccess'));

      // 跳转到重定向页面或首页
      const redirect = searchParams.get('redirect') || '/';
      setTimeout(() => {
        navigate(redirect);
      }, 300);
    } catch (error: any) {
      // 错误已在 store 中处理
    }
  };

  return (
    <div className="auth-form-container">
      {/* 标题 */}
      <div className="auth-form-header">
        <h2 className="auth-form-title">{t('welcomeBack')}</h2>
        <p className="auth-form-description">
          {t('loginDescription')}
        </p>
      </div>

      {/* 登录表单 */}
      <Form
        name="login"
        onFinish={handleSubmit}
        size="large"
        initialValues={{ remember: true }}
      >
        <Form.Item
          name="username"
          className="auth-form-item"
          rules={[
            {
              required: true,
              message: t('usernameRequired'),
            },
          ]}
        >
          <Input
            prefix={<UserOutlined />}
            placeholder={t('usernamePlaceholder')}
            autoComplete="username"
          />
        </Form.Item>

        <Form.Item
          name="password"
          className="auth-form-item"
          rules={[
            {
              required: true,
              message: t('passwordRequired'),
            },
          ]}
        >
          <Input.Password
            prefix={<LockOutlined />}
            placeholder={t('passwordPlaceholder')}
            autoComplete="current-password"
          />
        </Form.Item>

        <Form.Item className="auth-remember-checkbox">
          <div className="flex items-center justify-between">
            <Form.Item name="remember" valuePropName="checked" noStyle>
              <Checkbox>{t('rememberAccount')}</Checkbox>
            </Form.Item>
          </div>
        </Form.Item>

        <Form.Item>
          <Button
            type="primary"
            htmlType="submit"
            loading={loginLoading}
            block
            className="auth-submit-button"
          >
            {loginLoading ? t('loggingIn') : t('loginButton')}
          </Button>
        </Form.Item>
      </Form>

      {/* 底部链接 */}
      <div className="auth-footer-link">
        <span className="auth-footer-text">
          {t('noAccount')}{' '}
        </span>
        <a href="/auth/register" className="auth-footer-anchor">
          {t('createAccount')}
        </a>
      </div>
    </div>
  );
};

export default Login;
