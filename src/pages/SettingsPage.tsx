import { useState, useMemo } from 'react';
import { useI18n } from '../i18n';
import { useSettingsStore } from '../store/settingsStore';
import { useAuthStore } from '../store/authStore';
import { Icon, IconName } from '../components/Icon';
import styles from './SettingsPage.module.css';

type SettingsCategory = 'profile' | 'security' | 'trading' | 'notifications' | 'display' | 'privacy' | 'advanced';

interface NavItem {
  id: SettingsCategory;
  icon: IconName;
  badge?: string;
}

export function SettingsPage() {
  const { t } = useI18n();
  const [activeCategory, setActiveCategory] = useState<SettingsCategory>('profile');
  const { user } = useAuthStore();
  const settings = useSettingsStore();

  const navItems: NavItem[] = [
    { id: 'profile', icon: 'user' },
    { id: 'security', icon: 'shield', badge: getSecurityLevel() < 3 ? '!' : undefined },
    { id: 'trading', icon: 'bar-chart-3' },
    { id: 'notifications', icon: 'bell' },
    { id: 'display', icon: 'palette' },
    { id: 'privacy', icon: 'eye' },
    { id: 'advanced', icon: 'sliders' },
  ];

  function getSecurityLevel(): number {
    let level = 1;
    if (settings.security.twoFactorEnabled) level++;
    if (settings.security.fundPasswordSet) level++;
    if (settings.security.antiPhishingCode) level++;
    return level;
  }

  function getSecurityLevelLabel(): string {
    const level = getSecurityLevel();
    const labels = [
      t.settings?.security?.securityLevelLow || 'Low',
      t.settings?.security?.securityLevelMedium || 'Medium',
      t.settings?.security?.securityLevelHigh || 'High',
      t.settings?.security?.securityLevelMax || 'Maximum',
    ];
    return labels[level - 1];
  }

  function getSecurityLevelClass(): string {
    const level = getSecurityLevel();
    const classes = [
      styles.securityLevelLow,
      styles.securityLevelMedium,
      styles.securityLevelHigh,
      styles.securityLevelMax,
    ];
    return classes[level - 1];
  }

  const categoryTitle = t.settings?.categories?.[activeCategory] || activeCategory;

  return (
    <div className={styles.container}>
      {/* Sidebar Navigation */}
      <aside className={styles.sidebar}>
        <div className={styles.sidebarHeader}>
          <h1 className={styles.sidebarTitle}>
            <div className={styles.sidebarTitleIcon}>
              <Icon name="settings" size="lg" />
            </div>
            {t.settings?.title || 'Settings'}
          </h1>
        </div>

        <nav className={styles.navList}>
          {navItems.map((item) => (
            <button
              key={item.id}
              className={`${styles.navItem} ${activeCategory === item.id ? styles.navItemActive : ''}`}
              onClick={() => setActiveCategory(item.id)}
            >
              <span className={styles.navItemIcon}>
                <Icon name={item.icon} size="sm" />
              </span>
              <span className={styles.navItemLabel}>
                {t.settings?.categories?.[item.id] || item.id}
              </span>
              {item.badge && (
                <span className={styles.navItemBadge}>{item.badge}</span>
              )}
            </button>
          ))}
        </nav>

        <div className={styles.sidebarFooter}>
          <div className={styles.versionInfo}>
            <span>{t.settings?.advanced?.version || 'Version'}</span>
            <span>1.0.0</span>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className={styles.mainContent}>
        <div className={styles.contentWrapper}>
          {activeCategory === 'profile' && <ProfileSection />}
          {activeCategory === 'security' && <SecuritySection />}
          {activeCategory === 'trading' && <TradingSection />}
          {activeCategory === 'notifications' && <NotificationsSection />}
          {activeCategory === 'display' && <DisplaySection />}
          {activeCategory === 'privacy' && <PrivacySection />}
          {activeCategory === 'advanced' && <AdvancedSection />}
        </div>
      </main>
    </div>
  );
}

// ==================== Profile Section ====================
function ProfileSection() {
  const { t } = useI18n();
  const { user } = useAuthStore();
  const s = t.settings?.profile;

  return (
    <>
      <header className={styles.sectionHeader}>
        <h2 className={styles.sectionTitle}>
          <span className={styles.sectionTitleIcon}>
            <Icon name="user" size="lg" />
          </span>
          {s?.title || 'Profile'}
        </h2>
        <p className={styles.sectionSubtitle}>{s?.subtitle || 'Manage your account information'}</p>
      </header>

      {/* Profile Card */}
      <div className={styles.settingsCard}>
        <div className={styles.cardHeader}>
          <h3 className={styles.cardTitle}>
            <Icon name="user-cog" size="sm" />
            {s?.title || 'Profile'}
          </h3>
          <button className={styles.actionButton}>
            <Icon name="pencil" size="sm" />
            {s?.editProfile || 'Edit Profile'}
          </button>
        </div>
        <div className={styles.cardBody}>
          <div className={styles.settingItem}>
            <div className={styles.settingInfo}>
              <div className={styles.settingLabel}>{s?.avatar || 'Avatar'}</div>
            </div>
            <div className={styles.settingControl}>
              <div style={{
                width: 48,
                height: 48,
                borderRadius: '50%',
                background: 'linear-gradient(135deg, var(--accent) 0%, #a78bfa 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'white',
                fontWeight: 600,
                fontSize: 18,
              }}>
                {user?.username?.charAt(0).toUpperCase() || 'U'}
              </div>
            </div>
          </div>

          <div className={styles.settingItem}>
            <div className={styles.settingInfo}>
              <div className={styles.settingLabel}>{s?.username || 'Username'}</div>
            </div>
            <div className={styles.settingControl}>
              <span style={{ color: 'var(--text-primary)', fontWeight: 500 }}>
                {user?.username || 'demo_user'}
              </span>
            </div>
          </div>

          <div className={styles.settingItem}>
            <div className={styles.settingInfo}>
              <div className={styles.settingLabel}>{s?.email || 'Email'}</div>
            </div>
            <div className={styles.settingControl}>
              <span style={{ color: 'var(--text-secondary)' }}>
                {user?.email || 'demo@example.com'}
              </span>
            </div>
          </div>

          <div className={styles.settingItem}>
            <div className={styles.settingInfo}>
              <div className={styles.settingLabel}>{s?.timezone || 'Timezone'}</div>
            </div>
            <div className={styles.settingControl}>
              <select className={styles.select}>
                <option value="UTC+8">UTC+8 (Beijing)</option>
                <option value="UTC+0">UTC+0 (London)</option>
                <option value="UTC-5">UTC-5 (New York)</option>
                <option value="UTC-8">UTC-8 (Los Angeles)</option>
              </select>
            </div>
          </div>

          <div className={styles.settingItem}>
            <div className={styles.settingInfo}>
              <div className={styles.settingLabel}>{s?.accountLevel || 'Account Level'}</div>
            </div>
            <div className={styles.settingControl}>
              <span className={styles.statusBadge} style={{ background: 'var(--color-info-bg)', color: 'var(--color-info)' }}>
                Standard
              </span>
              <button className={`${styles.actionButton} ${styles.actionButtonSmall}`}>
                {s?.upgrade || 'Upgrade'}
              </button>
            </div>
          </div>

          <div className={styles.settingItem}>
            <div className={styles.settingInfo}>
              <div className={styles.settingLabel}>{s?.verificationStatus || 'Verification'}</div>
            </div>
            <div className={styles.settingControl}>
              <span className={`${styles.statusBadge} ${styles.statusEnabled}`}>
                <Icon name="check-circle" size="xs" />
                {s?.verified || 'Verified'}
              </span>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

// ==================== Security Section ====================
function SecuritySection() {
  const { t } = useI18n();
  const settings = useSettingsStore();
  const s = t.settings?.security;

  function getSecurityLevel(): number {
    let level = 1;
    if (settings.security.twoFactorEnabled) level++;
    if (settings.security.fundPasswordSet) level++;
    if (settings.security.antiPhishingCode) level++;
    return level;
  }

  function getSecurityLevelLabel(): string {
    const level = getSecurityLevel();
    const labels = [
      s?.securityLevelLow || 'Low',
      s?.securityLevelMedium || 'Medium',
      s?.securityLevelHigh || 'High',
      s?.securityLevelMax || 'Maximum',
    ];
    return labels[level - 1];
  }

  function getSecurityLevelClass(): string {
    const level = getSecurityLevel();
    const classes = [
      styles.securityLevelLow,
      styles.securityLevelMedium,
      styles.securityLevelHigh,
      styles.securityLevelMax,
    ];
    return classes[level - 1];
  }

  return (
    <>
      <header className={styles.sectionHeader}>
        <h2 className={styles.sectionTitle}>
          <span className={styles.sectionTitleIcon}>
            <Icon name="shield" size="lg" />
          </span>
          {s?.title || 'Security'}
        </h2>
        <p className={styles.sectionSubtitle}>{s?.subtitle || 'Protect your account'}</p>
      </header>

      {/* Security Level Indicator */}
      <div className={styles.securityLevel}>
        <div className={`${styles.securityLevelIcon} ${getSecurityLevelClass()}`}>
          <Icon name="shield-check" size="xl" />
        </div>
        <div className={styles.securityLevelInfo}>
          <div className={styles.securityLevelLabel}>{s?.securityLevel || 'Security Level'}</div>
          <div className={styles.securityLevelValue}>{getSecurityLevelLabel()}</div>
          <div className={styles.securityLevelBar}>
            {[1, 2, 3, 4].map((i) => (
              <div
                key={i}
                className={`${styles.securityLevelSegment} ${i <= getSecurityLevel() ? styles.securityLevelSegmentActive : ''}`}
              />
            ))}
          </div>
        </div>
        <div className={styles.securityRecommendations}>
          {!settings.security.twoFactorEnabled && (
            <div className={styles.recommendation}>
              <Icon name="alert-circle" size="xs" className={styles.recommendationIcon} />
              <span>{t.settings?.security?.twoFactorAuth || 'Enable 2FA'}</span>
            </div>
          )}
          {!settings.security.fundPasswordSet && (
            <div className={styles.recommendation}>
              <Icon name="alert-circle" size="xs" className={styles.recommendationIcon} />
              <span>{t.settings?.security?.fundPassword || 'Set Fund Password'}</span>
            </div>
          )}
        </div>
      </div>

      {/* Two-Factor Authentication */}
      <div className={styles.settingsCard}>
        <div className={styles.cardHeader}>
          <h3 className={styles.cardTitle}>
            <Icon name="smartphone" size="sm" />
            {s?.twoFactorAuth || '2FA'}
          </h3>
          <span className={`${styles.statusBadge} ${settings.security.twoFactorEnabled ? styles.statusEnabled : styles.statusDisabled}`}>
            {settings.security.twoFactorEnabled ? (s?.enabled || 'Enabled') : (s?.disabled || 'Disabled')}
          </span>
        </div>
        <div className={styles.cardBody}>
          <div className={styles.settingItem}>
            <div className={styles.settingInfo}>
              <div className={styles.settingLabel}>{s?.twoFactorAuth || 'Two-Factor Authentication'}</div>
              <div className={styles.settingDescription}>{s?.twoFactorAuthDesc || 'Use TOTP for secondary verification'}</div>
            </div>
            <div className={styles.settingControl}>
              <button
                className={`${styles.toggle} ${settings.security.twoFactorEnabled ? styles.toggleActive : ''}`}
                onClick={() => settings.updateSecurity({ twoFactorEnabled: !settings.security.twoFactorEnabled })}
              >
                <span className={styles.toggleKnob} />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Password Settings */}
      <div className={styles.settingsCard}>
        <div className={styles.cardHeader}>
          <h3 className={styles.cardTitle}>
            <Icon name="lock" size="sm" />
            {s?.loginPassword || 'Password'}
          </h3>
        </div>
        <div className={styles.cardBody}>
          <div className={styles.settingItem}>
            <div className={styles.settingInfo}>
              <div className={styles.settingLabel}>{s?.loginPassword || 'Login Password'}</div>
              <div className={styles.settingDescription}>{s?.loginPasswordDesc || 'Used to sign in to your account'}</div>
            </div>
            <div className={styles.settingControl}>
              <button className={styles.actionButton}>
                <Icon name="pencil" size="sm" />
                {s?.changePassword || 'Change'}
              </button>
            </div>
          </div>

          <div className={styles.settingItem}>
            <div className={styles.settingInfo}>
              <div className={styles.settingLabel}>{s?.fundPassword || 'Fund Password'}</div>
              <div className={styles.settingDescription}>{s?.fundPasswordDesc || 'Separate password for withdrawals'}</div>
            </div>
            <div className={styles.settingControl}>
              <span className={`${styles.statusBadge} ${settings.security.fundPasswordSet ? styles.statusEnabled : styles.statusWarning}`}>
                {settings.security.fundPasswordSet ? (s?.enabled || 'Set') : (s?.notSet || 'Not Set')}
              </span>
              <button className={styles.actionButton}>
                {settings.security.fundPasswordSet ? (s?.changePassword || 'Change') : (s?.setPassword || 'Set')}
              </button>
            </div>
          </div>

          <div className={styles.settingItem}>
            <div className={styles.settingInfo}>
              <div className={styles.settingLabel}>{s?.antiPhishing || 'Anti-Phishing Code'}</div>
              <div className={styles.settingDescription}>{s?.antiPhishingDesc || 'Verification code in official emails'}</div>
            </div>
            <div className={styles.settingControl}>
              {settings.security.antiPhishingCode ? (
                <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-primary)' }}>
                  {settings.security.antiPhishingCode}
                </span>
              ) : null}
              <button className={styles.actionButton}>
                {settings.security.antiPhishingCode ? (s?.changePassword || 'Change') : (s?.setCode || 'Set Code')}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Device Management */}
      <div className={styles.settingsCard}>
        <div className={styles.cardHeader}>
          <h3 className={styles.cardTitle}>
            <Icon name="monitor-smartphone" size="sm" />
            {s?.deviceManagement || 'Devices'}
          </h3>
          <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-tertiary)' }}>
            {settings.devices.length} {s?.trustedDevices || 'devices'}
          </span>
        </div>
        <div className={styles.cardBody}>
          <div className={styles.deviceList}>
            {settings.devices.map((device) => (
              <div key={device.id} className={`${styles.deviceItem} ${device.isCurrent ? styles.deviceItemCurrent : ''}`}>
                <div className={styles.deviceIcon}>
                  <Icon name={device.os === 'Windows' || device.os === 'macOS' || device.os === 'Linux' ? 'monitor' : 'smartphone'} size="lg" />
                </div>
                <div className={styles.deviceInfo}>
                  <div className={styles.deviceName}>
                    {device.name}
                    {device.isCurrent && <span className={styles.currentBadge}>{s?.currentDevice || 'Current'}</span>}
                  </div>
                  <div className={styles.deviceMeta}>
                    {device.browser} · {device.os} · {s?.lastActive || 'Last active'}: {new Date(device.lastActive).toLocaleDateString()}
                  </div>
                </div>
                {!device.isCurrent && (
                  <button className={`${styles.actionButton} ${styles.actionButtonSmall} ${styles.deviceAction}`}>
                    <Icon name="x" size="xs" />
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* API Keys */}
      <div className={styles.settingsCard}>
        <div className={styles.cardHeader}>
          <h3 className={styles.cardTitle}>
            <Icon name="key" size="sm" />
            {s?.apiKeys || 'API Keys'}
          </h3>
          <button className={`${styles.actionButton} ${styles.actionButtonPrimary}`}>
            <Icon name="plus" size="sm" />
            {s?.createApiKey || 'Create'}
          </button>
        </div>
        <div className={styles.cardBody}>
          {settings.apiKeys.length === 0 ? (
            <div className={styles.emptyState}>
              <div className={styles.emptyStateIcon}>
                <Icon name="key-round" size="xl" />
              </div>
              <div className={styles.emptyStateTitle}>No API Keys</div>
              <div className={styles.emptyStateDescription}>
                {s?.apiKeysDesc || 'Create API keys for programmatic trading'}
              </div>
            </div>
          ) : (
            <div className={styles.apiKeyList}>
              {settings.apiKeys.map((apiKey) => (
                <div key={apiKey.id} className={styles.apiKeyItem}>
                  <div className={styles.apiKeyIcon}>
                    <Icon name="key" size="lg" />
                  </div>
                  <div className={styles.apiKeyInfo}>
                    <div className={styles.apiKeyName}>{apiKey.name}</div>
                    <div className={styles.apiKeyMeta}>
                      <span>{s?.apiKeyCreated || 'Created'}: {new Date(apiKey.created).toLocaleDateString()}</span>
                    </div>
                  </div>
                  <div className={styles.apiKeyPermissions}>
                    {apiKey.permissions.map((p) => (
                      <span key={p} className={styles.permissionBadge}>{p}</span>
                    ))}
                  </div>
                  <div className={styles.apiKeyActions}>
                    <button className={`${styles.actionButton} ${styles.actionButtonSmall}`}>
                      <Icon name="eye" size="xs" />
                    </button>
                    <button className={`${styles.actionButton} ${styles.actionButtonSmall}`}>
                      <Icon name="trash-2" size="xs" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Session Settings */}
      <div className={styles.settingsCard}>
        <div className={styles.cardHeader}>
          <h3 className={styles.cardTitle}>
            <Icon name="timer" size="sm" />
            {s?.sessionTimeout || 'Session'}
          </h3>
        </div>
        <div className={styles.cardBody}>
          <div className={styles.settingItem}>
            <div className={styles.settingInfo}>
              <div className={styles.settingLabel}>{s?.sessionTimeout || 'Session Timeout'}</div>
              <div className={styles.settingDescription}>{s?.sessionTimeoutDesc || 'Auto-logout after inactivity'}</div>
            </div>
            <div className={styles.settingControl}>
              <select
                className={styles.select}
                value={settings.security.sessionTimeout}
                onChange={(e) => settings.updateSecurity({ sessionTimeout: parseInt(e.target.value) })}
              >
                <option value="15">15 {s?.minutes || 'min'}</option>
                <option value="30">30 {s?.minutes || 'min'}</option>
                <option value="60">60 {s?.minutes || 'min'}</option>
                <option value="120">120 {s?.minutes || 'min'}</option>
              </select>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

// ==================== Trading Section ====================
function TradingSection() {
  const { t } = useI18n();
  const settings = useSettingsStore();
  const s = t.settings?.trading;

  return (
    <>
      <header className={styles.sectionHeader}>
        <h2 className={styles.sectionTitle}>
          <span className={styles.sectionTitleIcon}>
            <Icon name="bar-chart-3" size="lg" />
          </span>
          {s?.title || 'Trading'}
        </h2>
        <p className={styles.sectionSubtitle}>{s?.subtitle || 'Customize your trading experience'}</p>
      </header>

      {/* Default Settings */}
      <div className={styles.settingsCard}>
        <div className={styles.cardHeader}>
          <h3 className={styles.cardTitle}>
            <Icon name="target" size="sm" />
            {s?.defaultSymbol || 'Defaults'}
          </h3>
        </div>
        <div className={styles.cardBody}>
          <div className={styles.settingItem}>
            <div className={styles.settingInfo}>
              <div className={styles.settingLabel}>{s?.defaultSymbol || 'Default Symbol'}</div>
              <div className={styles.settingDescription}>{s?.defaultSymbolDesc || 'Symbol loaded at startup'}</div>
            </div>
            <div className={styles.settingControl}>
              <select
                className={styles.select}
                value={settings.trading.defaultSymbol}
                onChange={(e) => settings.updateTrading({ defaultSymbol: e.target.value })}
              >
                <option value="BTCUSDT">BTCUSDT</option>
                <option value="ETHUSDT">ETHUSDT</option>
                <option value="BNBUSDT">BNBUSDT</option>
                <option value="SOLUSDT">SOLUSDT</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* Order Confirmation */}
      <div className={styles.settingsCard}>
        <div className={styles.cardHeader}>
          <h3 className={styles.cardTitle}>
            <Icon name="check-circle" size="sm" />
            {s?.orderConfirmation || 'Confirmation'}
          </h3>
        </div>
        <div className={styles.cardBody}>
          <div className={styles.settingItem}>
            <div className={styles.settingInfo}>
              <div className={styles.settingLabel}>{s?.marketOrder || 'Market Order'}</div>
              <div className={styles.settingDescription}>{s?.orderConfirmationDesc || 'Show confirmation before submit'}</div>
            </div>
            <div className={styles.settingControl}>
              <button
                className={`${styles.toggle} ${settings.trading.orderConfirmation.market ? styles.toggleActive : ''}`}
                onClick={() => settings.updateTrading({
                  orderConfirmation: { ...settings.trading.orderConfirmation, market: !settings.trading.orderConfirmation.market }
                })}
              >
                <span className={styles.toggleKnob} />
              </button>
            </div>
          </div>

          <div className={styles.settingItem}>
            <div className={styles.settingInfo}>
              <div className={styles.settingLabel}>{s?.limitOrder || 'Limit Order'}</div>
            </div>
            <div className={styles.settingControl}>
              <button
                className={`${styles.toggle} ${settings.trading.orderConfirmation.limit ? styles.toggleActive : ''}`}
                onClick={() => settings.updateTrading({
                  orderConfirmation: { ...settings.trading.orderConfirmation, limit: !settings.trading.orderConfirmation.limit }
                })}
              >
                <span className={styles.toggleKnob} />
              </button>
            </div>
          </div>

          <div className={styles.settingItem}>
            <div className={styles.settingInfo}>
              <div className={styles.settingLabel}>{s?.largeOrder || 'Large Order'}</div>
            </div>
            <div className={styles.settingControl}>
              <button
                className={`${styles.toggle} ${settings.trading.orderConfirmation.large ? styles.toggleActive : ''}`}
                onClick={() => settings.updateTrading({
                  orderConfirmation: { ...settings.trading.orderConfirmation, large: !settings.trading.orderConfirmation.large }
                })}
              >
                <span className={styles.toggleKnob} />
              </button>
            </div>
          </div>

          <div className={styles.settingItem}>
            <div className={styles.settingInfo}>
              <div className={styles.settingLabel}>{s?.largeOrderThreshold || 'Threshold'}</div>
            </div>
            <div className={styles.settingControl}>
              <input
                type="number"
                className={styles.inputField}
                style={{ width: 120 }}
                value={settings.trading.orderConfirmation.largeThreshold}
                onChange={(e) => settings.updateTrading({
                  orderConfirmation: { ...settings.trading.orderConfirmation, largeThreshold: parseInt(e.target.value) || 0 }
                })}
              />
              <span style={{ color: 'var(--text-tertiary)', fontSize: 'var(--font-size-sm)' }}>USDT</span>
            </div>
          </div>
        </div>
      </div>

      {/* Sound Effects */}
      <div className={styles.settingsCard}>
        <div className={styles.cardHeader}>
          <h3 className={styles.cardTitle}>
            <Icon name="volume-2" size="sm" />
            {s?.soundEffects || 'Sound'}
          </h3>
          <button
            className={`${styles.toggle} ${settings.trading.soundEffects.enabled ? styles.toggleActive : ''}`}
            onClick={() => settings.updateTrading({
              soundEffects: { ...settings.trading.soundEffects, enabled: !settings.trading.soundEffects.enabled }
            })}
          >
            <span className={styles.toggleKnob} />
          </button>
        </div>
        <div className={styles.cardBody}>
          <div className={styles.settingItem}>
            <div className={styles.settingInfo}>
              <div className={styles.settingLabel}>{s?.orderFilled || 'Order Filled'}</div>
            </div>
            <div className={styles.settingControl}>
              <button
                className={`${styles.toggle} ${settings.trading.soundEffects.orderFilled ? styles.toggleActive : ''}`}
                onClick={() => settings.updateTrading({
                  soundEffects: { ...settings.trading.soundEffects, orderFilled: !settings.trading.soundEffects.orderFilled }
                })}
                disabled={!settings.trading.soundEffects.enabled}
              >
                <span className={styles.toggleKnob} />
              </button>
            </div>
          </div>

          <div className={styles.settingItem}>
            <div className={styles.settingInfo}>
              <div className={styles.settingLabel}>{s?.orderCancelled || 'Order Cancelled'}</div>
            </div>
            <div className={styles.settingControl}>
              <button
                className={`${styles.toggle} ${settings.trading.soundEffects.orderCancelled ? styles.toggleActive : ''}`}
                onClick={() => settings.updateTrading({
                  soundEffects: { ...settings.trading.soundEffects, orderCancelled: !settings.trading.soundEffects.orderCancelled }
                })}
                disabled={!settings.trading.soundEffects.enabled}
              >
                <span className={styles.toggleKnob} />
              </button>
            </div>
          </div>

          <div className={styles.settingItem}>
            <div className={styles.settingInfo}>
              <div className={styles.settingLabel}>{s?.priceAlert || 'Price Alert'}</div>
            </div>
            <div className={styles.settingControl}>
              <button
                className={`${styles.toggle} ${settings.trading.soundEffects.priceAlert ? styles.toggleActive : ''}`}
                onClick={() => settings.updateTrading({
                  soundEffects: { ...settings.trading.soundEffects, priceAlert: !settings.trading.soundEffects.priceAlert }
                })}
                disabled={!settings.trading.soundEffects.enabled}
              >
                <span className={styles.toggleKnob} />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Risk Management */}
      <div className={styles.settingsCard}>
        <div className={styles.cardHeader}>
          <h3 className={styles.cardTitle}>
            <Icon name="shield-alert" size="sm" />
            {s?.riskManagement || 'Risk'}
          </h3>
        </div>
        <div className={styles.cardBody}>
          <div className={styles.settingItem}>
            <div className={styles.settingInfo}>
              <div className={styles.settingLabel}>{s?.maxPositionSize || 'Max Position'}</div>
              <div className={styles.settingDescription}>{s?.riskManagementDesc || 'Risk control parameters'}</div>
            </div>
            <div className={styles.settingControl}>
              <input
                type="range"
                className={styles.slider}
                min="5"
                max="100"
                value={settings.trading.riskManagement.maxPositionSize}
                onChange={(e) => settings.updateTrading({
                  riskManagement: { ...settings.trading.riskManagement, maxPositionSize: parseInt(e.target.value) }
                })}
              />
              <span className={styles.sliderValue}>{settings.trading.riskManagement.maxPositionSize}%</span>
            </div>
          </div>

          <div className={styles.settingItem}>
            <div className={styles.settingInfo}>
              <div className={styles.settingLabel}>{s?.dailyLossLimit || 'Daily Loss Limit'}</div>
            </div>
            <div className={styles.settingControl}>
              <input
                type="range"
                className={styles.slider}
                min="1"
                max="20"
                value={settings.trading.riskManagement.dailyLossLimit}
                onChange={(e) => settings.updateTrading({
                  riskManagement: { ...settings.trading.riskManagement, dailyLossLimit: parseInt(e.target.value) }
                })}
              />
              <span className={styles.sliderValue}>{settings.trading.riskManagement.dailyLossLimit}%</span>
            </div>
          </div>

          <div className={styles.settingItem}>
            <div className={styles.settingInfo}>
              <div className={styles.settingLabel}>{s?.autoStopLoss || 'Auto Stop Loss'}</div>
            </div>
            <div className={styles.settingControl}>
              <button
                className={`${styles.toggle} ${settings.trading.riskManagement.autoStopLoss ? styles.toggleActive : ''}`}
                onClick={() => settings.updateTrading({
                  riskManagement: { ...settings.trading.riskManagement, autoStopLoss: !settings.trading.riskManagement.autoStopLoss }
                })}
              >
                <span className={styles.toggleKnob} />
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

// ==================== Notifications Section ====================
function NotificationsSection() {
  const { t } = useI18n();
  const settings = useSettingsStore();
  const s = t.settings?.notifications;

  return (
    <>
      <header className={styles.sectionHeader}>
        <h2 className={styles.sectionTitle}>
          <span className={styles.sectionTitleIcon}>
            <Icon name="bell" size="lg" />
          </span>
          {s?.title || 'Notifications'}
        </h2>
        <p className={styles.sectionSubtitle}>{s?.subtitle || 'Control notification preferences'}</p>
      </header>

      {/* Channels */}
      <div className={styles.settingsCard}>
        <div className={styles.cardHeader}>
          <h3 className={styles.cardTitle}>
            <Icon name="send" size="sm" />
            Channels
          </h3>
        </div>
        <div className={styles.cardBody}>
          <div className={styles.settingItem}>
            <div className={styles.settingInfo}>
              <div className={styles.settingLabel}>
                <Icon name="bell-ring" size="xs" />
                {s?.pushNotifications || 'Push'}
              </div>
              <div className={styles.settingDescription}>{s?.pushNotificationsDesc || 'Real-time push notifications'}</div>
            </div>
            <div className={styles.settingControl}>
              <button
                className={`${styles.toggle} ${settings.notifications.push ? styles.toggleActive : ''}`}
                onClick={() => settings.updateNotifications({ push: !settings.notifications.push })}
              >
                <span className={styles.toggleKnob} />
              </button>
            </div>
          </div>

          <div className={styles.settingItem}>
            <div className={styles.settingInfo}>
              <div className={styles.settingLabel}>
                <Icon name="mail" size="xs" />
                {s?.emailNotifications || 'Email'}
              </div>
              <div className={styles.settingDescription}>{s?.emailNotificationsDesc || 'Email notifications'}</div>
            </div>
            <div className={styles.settingControl}>
              <button
                className={`${styles.toggle} ${settings.notifications.email ? styles.toggleActive : ''}`}
                onClick={() => settings.updateNotifications({ email: !settings.notifications.email })}
              >
                <span className={styles.toggleKnob} />
              </button>
            </div>
          </div>

          <div className={styles.settingItem}>
            <div className={styles.settingInfo}>
              <div className={styles.settingLabel}>
                <Icon name="smartphone" size="xs" />
                {s?.smsNotifications || 'SMS'}
              </div>
              <div className={styles.settingDescription}>{s?.smsNotificationsDesc || 'SMS notifications'}</div>
            </div>
            <div className={styles.settingControl}>
              <button
                className={`${styles.toggle} ${settings.notifications.sms ? styles.toggleActive : ''}`}
                onClick={() => settings.updateNotifications({ sms: !settings.notifications.sms })}
              >
                <span className={styles.toggleKnob} />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Notification Types */}
      <div className={styles.settingsCard}>
        <div className={styles.cardHeader}>
          <h3 className={styles.cardTitle}>
            <Icon name="list" size="sm" />
            {s?.notificationTypes || 'Types'}
          </h3>
        </div>
        <div className={styles.cardBody}>
          <div className={styles.settingItem}>
            <div className={styles.settingInfo}>
              <div className={styles.settingLabel}>{s?.orderUpdates || 'Order Updates'}</div>
              <div className={styles.settingDescription}>{s?.orderUpdatesDesc || 'Order status changes'}</div>
            </div>
            <div className={styles.settingControl}>
              <button
                className={`${styles.toggle} ${settings.notifications.types.orderUpdates ? styles.toggleActive : ''}`}
                onClick={() => settings.updateNotifications({
                  types: { ...settings.notifications.types, orderUpdates: !settings.notifications.types.orderUpdates }
                })}
              >
                <span className={styles.toggleKnob} />
              </button>
            </div>
          </div>

          <div className={styles.settingItem}>
            <div className={styles.settingInfo}>
              <div className={styles.settingLabel}>{s?.priceMovements || 'Price Movements'}</div>
              <div className={styles.settingDescription}>{s?.priceMovementsDesc || 'Price change alerts'}</div>
            </div>
            <div className={styles.settingControl}>
              <button
                className={`${styles.toggle} ${settings.notifications.types.priceMovements ? styles.toggleActive : ''}`}
                onClick={() => settings.updateNotifications({
                  types: { ...settings.notifications.types, priceMovements: !settings.notifications.types.priceMovements }
                })}
              >
                <span className={styles.toggleKnob} />
              </button>
            </div>
          </div>

          <div className={styles.settingItem}>
            <div className={styles.settingInfo}>
              <div className={styles.settingLabel}>{s?.securityAlerts || 'Security'}</div>
              <div className={styles.settingDescription}>{s?.securityAlertsDesc || 'Security notifications'}</div>
            </div>
            <div className={styles.settingControl}>
              <button
                className={`${styles.toggle} ${settings.notifications.types.securityAlerts ? styles.toggleActive : ''}`}
                onClick={() => settings.updateNotifications({
                  types: { ...settings.notifications.types, securityAlerts: !settings.notifications.types.securityAlerts }
                })}
              >
                <span className={styles.toggleKnob} />
              </button>
            </div>
          </div>

          <div className={styles.settingItem}>
            <div className={styles.settingInfo}>
              <div className={styles.settingLabel}>{s?.systemAnnouncements || 'System'}</div>
              <div className={styles.settingDescription}>{s?.systemAnnouncementsDesc || 'System announcements'}</div>
            </div>
            <div className={styles.settingControl}>
              <button
                className={`${styles.toggle} ${settings.notifications.types.systemAnnouncements ? styles.toggleActive : ''}`}
                onClick={() => settings.updateNotifications({
                  types: { ...settings.notifications.types, systemAnnouncements: !settings.notifications.types.systemAnnouncements }
                })}
              >
                <span className={styles.toggleKnob} />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Quiet Hours */}
      <div className={styles.settingsCard}>
        <div className={styles.cardHeader}>
          <h3 className={styles.cardTitle}>
            <Icon name="moon" size="sm" />
            {s?.quietHours || 'Quiet Hours'}
          </h3>
          <button
            className={`${styles.toggle} ${settings.notifications.quietHours.enabled ? styles.toggleActive : ''}`}
            onClick={() => settings.updateNotifications({
              quietHours: { ...settings.notifications.quietHours, enabled: !settings.notifications.quietHours.enabled }
            })}
          >
            <span className={styles.toggleKnob} />
          </button>
        </div>
        <div className={styles.cardBody}>
          <div className={styles.settingItem}>
            <div className={styles.settingInfo}>
              <div className={styles.settingLabel}>{s?.quietHours || 'Quiet Hours'}</div>
              <div className={styles.settingDescription}>{s?.quietHoursDesc || 'Suppress non-urgent notifications'}</div>
            </div>
            <div className={styles.settingControl}>
              <span style={{ fontSize: 'var(--font-size-sm)', color: 'var(--text-secondary)' }}>{s?.from || 'From'}</span>
              <input
                type="time"
                className={styles.inputField}
                style={{ width: 100 }}
                value={settings.notifications.quietHours.from}
                onChange={(e) => settings.updateNotifications({
                  quietHours: { ...settings.notifications.quietHours, from: e.target.value }
                })}
                disabled={!settings.notifications.quietHours.enabled}
              />
              <span style={{ fontSize: 'var(--font-size-sm)', color: 'var(--text-secondary)' }}>{s?.to || 'To'}</span>
              <input
                type="time"
                className={styles.inputField}
                style={{ width: 100 }}
                value={settings.notifications.quietHours.to}
                onChange={(e) => settings.updateNotifications({
                  quietHours: { ...settings.notifications.quietHours, to: e.target.value }
                })}
                disabled={!settings.notifications.quietHours.enabled}
              />
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

// ==================== Display Section ====================
function DisplaySection() {
  const { t, setLocale, locale } = useI18n();
  const settings = useSettingsStore();
  const s = t.settings?.display;

  const accentColors = ['#58A6FF', '#3FB950', '#D29922', '#F85149', '#A78BFA', '#EC4899', '#14B8A6'];

  const handleThemeChange = (theme: 'light' | 'dark' | 'system') => {
    settings.updateDisplay({ theme });
    if (theme === 'system') {
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      document.documentElement.setAttribute('data-theme', prefersDark ? 'dark' : 'light');
    } else {
      document.documentElement.setAttribute('data-theme', theme);
    }
    localStorage.setItem('theme', theme);
  };

  return (
    <>
      <header className={styles.sectionHeader}>
        <h2 className={styles.sectionTitle}>
          <span className={styles.sectionTitleIcon}>
            <Icon name="palette" size="lg" />
          </span>
          {s?.title || 'Display'}
        </h2>
        <p className={styles.sectionSubtitle}>{s?.subtitle || 'Personalize your interface'}</p>
      </header>

      {/* Theme */}
      <div className={styles.settingsCard}>
        <div className={styles.cardHeader}>
          <h3 className={styles.cardTitle}>
            <Icon name="sun" size="sm" />
            {s?.theme || 'Theme'}
          </h3>
        </div>
        <div className={styles.cardBody}>
          <div className={styles.settingItem}>
            <div className={styles.settingInfo}>
              <div className={styles.settingLabel}>{s?.theme || 'Theme'}</div>
              <div className={styles.settingDescription}>{s?.themeDesc || 'Choose color theme'}</div>
            </div>
            <div className={styles.settingControl}>
              <div className={styles.radioGroup}>
                <button
                  className={`${styles.radioOption} ${settings.display.theme === 'light' ? styles.radioOptionActive : ''}`}
                  onClick={() => handleThemeChange('light')}
                >
                  <Icon name="sun" size="xs" />
                  {s?.light || 'Light'}
                </button>
                <button
                  className={`${styles.radioOption} ${settings.display.theme === 'dark' ? styles.radioOptionActive : ''}`}
                  onClick={() => handleThemeChange('dark')}
                >
                  <Icon name="moon" size="xs" />
                  {s?.dark || 'Dark'}
                </button>
                <button
                  className={`${styles.radioOption} ${settings.display.theme === 'system' ? styles.radioOptionActive : ''}`}
                  onClick={() => handleThemeChange('system')}
                >
                  <Icon name="monitor" size="xs" />
                  {s?.system || 'System'}
                </button>
              </div>
            </div>
          </div>

          <div className={styles.settingItem}>
            <div className={styles.settingInfo}>
              <div className={styles.settingLabel}>{s?.accentColor || 'Accent'}</div>
              <div className={styles.settingDescription}>{s?.accentColorDesc || 'Customize accent color'}</div>
            </div>
            <div className={styles.settingControl}>
              <div className={styles.colorPicker}>
                {accentColors.map((color) => (
                  <button
                    key={color}
                    className={`${styles.colorOption} ${settings.display.accentColor === color ? styles.colorOptionActive : ''}`}
                    style={{ background: color }}
                    onClick={() => settings.updateDisplay({ accentColor: color })}
                  />
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Language */}
      <div className={styles.settingsCard}>
        <div className={styles.cardHeader}>
          <h3 className={styles.cardTitle}>
            <Icon name="languages" size="sm" />
            {s?.language || 'Language'}
          </h3>
        </div>
        <div className={styles.cardBody}>
          <div className={styles.settingItem}>
            <div className={styles.settingInfo}>
              <div className={styles.settingLabel}>{s?.language || 'Language'}</div>
              <div className={styles.settingDescription}>{s?.languageDesc || 'Choose display language'}</div>
            </div>
            <div className={styles.settingControl}>
              <select
                className={styles.select}
                value={locale}
                onChange={(e) => setLocale(e.target.value as 'zh-CN' | 'en-US')}
              >
                <option value="zh-CN">中文</option>
                <option value="en-US">English</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* Format */}
      <div className={styles.settingsCard}>
        <div className={styles.cardHeader}>
          <h3 className={styles.cardTitle}>
            <Icon name="clock" size="sm" />
            Format
          </h3>
        </div>
        <div className={styles.cardBody}>
          <div className={styles.settingItem}>
            <div className={styles.settingInfo}>
              <div className={styles.settingLabel}>{s?.timeFormat || 'Time Format'}</div>
            </div>
            <div className={styles.settingControl}>
              <div className={styles.radioGroup}>
                <button
                  className={`${styles.radioOption} ${settings.display.timeFormat === '12h' ? styles.radioOptionActive : ''}`}
                  onClick={() => settings.updateDisplay({ timeFormat: '12h' })}
                >
                  {s?.timeFormat12h || '12h'}
                </button>
                <button
                  className={`${styles.radioOption} ${settings.display.timeFormat === '24h' ? styles.radioOptionActive : ''}`}
                  onClick={() => settings.updateDisplay({ timeFormat: '24h' })}
                >
                  {s?.timeFormat24h || '24h'}
                </button>
              </div>
            </div>
          </div>

          <div className={styles.settingItem}>
            <div className={styles.settingInfo}>
              <div className={styles.settingLabel}>{s?.dateFormat || 'Date Format'}</div>
            </div>
            <div className={styles.settingControl}>
              <select
                className={styles.select}
                value={settings.display.dateFormat}
                onChange={(e) => settings.updateDisplay({ dateFormat: e.target.value as any })}
              >
                <option value="YYYY-MM-DD">YYYY-MM-DD</option>
                <option value="MM/DD/YYYY">MM/DD/YYYY</option>
                <option value="DD/MM/YYYY">DD/MM/YYYY</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* Chart */}
      <div className={styles.settingsCard}>
        <div className={styles.cardHeader}>
          <h3 className={styles.cardTitle}>
            <Icon name="line-chart" size="sm" />
            {s?.chartStyle || 'Chart'}
          </h3>
        </div>
        <div className={styles.cardBody}>
          <div className={styles.settingItem}>
            <div className={styles.settingInfo}>
              <div className={styles.settingLabel}>{s?.chartStyle || 'Chart Style'}</div>
              <div className={styles.settingDescription}>{s?.chartStyleDesc || 'Default chart type'}</div>
            </div>
            <div className={styles.settingControl}>
              <div className={styles.radioGroup}>
                <button
                  className={`${styles.radioOption} ${settings.display.chartStyle === 'candlestick' ? styles.radioOptionActive : ''}`}
                  onClick={() => settings.updateDisplay({ chartStyle: 'candlestick' })}
                >
                  {s?.candlestick || 'Candle'}
                </button>
                <button
                  className={`${styles.radioOption} ${settings.display.chartStyle === 'line' ? styles.radioOptionActive : ''}`}
                  onClick={() => settings.updateDisplay({ chartStyle: 'line' })}
                >
                  {s?.line || 'Line'}
                </button>
                <button
                  className={`${styles.radioOption} ${settings.display.chartStyle === 'area' ? styles.radioOptionActive : ''}`}
                  onClick={() => settings.updateDisplay({ chartStyle: 'area' })}
                >
                  {s?.area || 'Area'}
                </button>
              </div>
            </div>
          </div>

          <div className={styles.settingItem}>
            <div className={styles.settingInfo}>
              <div className={styles.settingLabel}>Colors</div>
            </div>
            <div className={styles.settingControl}>
              <div className={styles.radioGroup}>
                <button
                  className={`${styles.radioOption} ${settings.display.chartColors === 'greenRed' ? styles.radioOptionActive : ''}`}
                  onClick={() => settings.updateDisplay({ chartColors: 'greenRed' })}
                >
                  <span style={{ color: 'var(--color-success)' }}>▲</span>
                  <span style={{ color: 'var(--color-error)' }}>▼</span>
                </button>
                <button
                  className={`${styles.radioOption} ${settings.display.chartColors === 'redGreen' ? styles.radioOptionActive : ''}`}
                  onClick={() => settings.updateDisplay({ chartColors: 'redGreen' })}
                >
                  <span style={{ color: 'var(--color-error)' }}>▲</span>
                  <span style={{ color: 'var(--color-success)' }}>▼</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Animations */}
      <div className={styles.settingsCard}>
        <div className={styles.cardHeader}>
          <h3 className={styles.cardTitle}>
            <Icon name="zap" size="sm" />
            {s?.animations || 'Animations'}
          </h3>
        </div>
        <div className={styles.cardBody}>
          <div className={styles.settingItem}>
            <div className={styles.settingInfo}>
              <div className={styles.settingLabel}>{s?.animations || 'Animations'}</div>
              <div className={styles.settingDescription}>{s?.animationsDesc || 'Enable animations'}</div>
            </div>
            <div className={styles.settingControl}>
              <button
                className={`${styles.toggle} ${settings.display.animations ? styles.toggleActive : ''}`}
                onClick={() => settings.updateDisplay({ animations: !settings.display.animations })}
              >
                <span className={styles.toggleKnob} />
              </button>
            </div>
          </div>

          <div className={styles.settingItem}>
            <div className={styles.settingInfo}>
              <div className={styles.settingLabel}>{s?.reducedMotion || 'Reduced Motion'}</div>
              <div className={styles.settingDescription}>{s?.reducedMotionDesc || 'Reduce animations'}</div>
            </div>
            <div className={styles.settingControl}>
              <button
                className={`${styles.toggle} ${settings.display.reducedMotion ? styles.toggleActive : ''}`}
                onClick={() => settings.updateDisplay({ reducedMotion: !settings.display.reducedMotion })}
              >
                <span className={styles.toggleKnob} />
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

// ==================== Privacy Section ====================
function PrivacySection() {
  const { t } = useI18n();
  const settings = useSettingsStore();
  const s = t.settings?.privacy;

  return (
    <>
      <header className={styles.sectionHeader}>
        <h2 className={styles.sectionTitle}>
          <span className={styles.sectionTitleIcon}>
            <Icon name="eye" size="lg" />
          </span>
          {s?.title || 'Privacy'}
        </h2>
        <p className={styles.sectionSubtitle}>{s?.subtitle || 'Manage your data and privacy'}</p>
      </header>

      {/* Data Export */}
      <div className={styles.settingsCard}>
        <div className={styles.cardHeader}>
          <h3 className={styles.cardTitle}>
            <Icon name="download" size="sm" />
            {s?.dataExport || 'Export'}
          </h3>
        </div>
        <div className={styles.cardBody}>
          <div className={styles.settingItem}>
            <div className={styles.settingInfo}>
              <div className={styles.settingLabel}>{s?.dataExport || 'Data Export'}</div>
              <div className={styles.settingDescription}>{s?.dataExportDesc || 'Download your data'}</div>
            </div>
            <div className={styles.settingControl}>
              <button className={styles.actionButton}>
                <Icon name="download" size="sm" />
                {s?.exportTrades || 'Trades'}
              </button>
              <button className={styles.actionButton}>
                <Icon name="download" size="sm" />
                {s?.exportOrders || 'Orders'}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Privacy Settings */}
      <div className={styles.settingsCard}>
        <div className={styles.cardHeader}>
          <h3 className={styles.cardTitle}>
            <Icon name="shield" size="sm" />
            Privacy
          </h3>
        </div>
        <div className={styles.cardBody}>
          <div className={styles.settingItem}>
            <div className={styles.settingInfo}>
              <div className={styles.settingLabel}>{s?.shareData || 'Share Usage Data'}</div>
              <div className={styles.settingDescription}>{s?.analyticsDesc || 'Help improve the product'}</div>
            </div>
            <div className={styles.settingControl}>
              <button
                className={`${styles.toggle} ${settings.privacy.shareAnalytics ? styles.toggleActive : ''}`}
                onClick={() => settings.updatePrivacy({ shareAnalytics: !settings.privacy.shareAnalytics })}
              >
                <span className={styles.toggleKnob} />
              </button>
            </div>
          </div>

          <div className={styles.settingItem}>
            <div className={styles.settingInfo}>
              <div className={styles.settingLabel}>{s?.personalizedAds || 'Personalization'}</div>
              <div className={styles.settingDescription}>{s?.personalizedAdsDesc || 'Personalized recommendations'}</div>
            </div>
            <div className={styles.settingControl}>
              <button
                className={`${styles.toggle} ${settings.privacy.personalizedRecommendations ? styles.toggleActive : ''}`}
                onClick={() => settings.updatePrivacy({ personalizedRecommendations: !settings.privacy.personalizedRecommendations })}
              >
                <span className={styles.toggleKnob} />
              </button>
            </div>
          </div>

          <div className={styles.settingItem}>
            <div className={styles.settingInfo}>
              <div className={styles.settingLabel}>{s?.hideBalances || 'Hide Balances'}</div>
              <div className={styles.settingDescription}>{s?.hideBalancesDesc || 'Hide asset balances'}</div>
            </div>
            <div className={styles.settingControl}>
              <button
                className={`${styles.toggle} ${settings.privacy.hideBalances ? styles.toggleActive : ''}`}
                onClick={() => settings.updatePrivacy({ hideBalances: !settings.privacy.hideBalances })}
              >
                <span className={styles.toggleKnob} />
              </button>
            </div>
          </div>

          <div className={styles.settingItem}>
            <div className={styles.settingInfo}>
              <div className={styles.settingLabel}>{s?.incognitoMode || 'Incognito'}</div>
              <div className={styles.settingDescription}>{s?.incognitoModeDesc || 'Don\'t record history'}</div>
            </div>
            <div className={styles.settingControl}>
              <button
                className={`${styles.toggle} ${settings.privacy.incognitoMode ? styles.toggleActive : ''}`}
                onClick={() => settings.updatePrivacy({ incognitoMode: !settings.privacy.incognitoMode })}
              >
                <span className={styles.toggleKnob} />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Danger Zone */}
      <div className={`${styles.settingsCard} ${styles.dangerZone}`}>
        <div className={styles.cardHeader}>
          <h3 className={styles.cardTitle}>
            <Icon name="alert-triangle" size="sm" />
            {s?.deleteAccount || 'Delete Account'}
          </h3>
        </div>
        <div className={styles.cardBody}>
          <div className={styles.settingItem}>
            <div className={styles.settingInfo}>
              <div className={styles.settingLabel}>{s?.deleteAccount || 'Delete Account'}</div>
              <div className={styles.settingDescription}>{s?.deleteAccountWarning || 'This action cannot be undone'}</div>
            </div>
            <div className={styles.settingControl}>
              <button className={`${styles.actionButton} ${styles.actionButtonDanger}`}>
                <Icon name="trash-2" size="sm" />
                {s?.confirmDelete || 'Delete'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

// ==================== Advanced Section ====================
function AdvancedSection() {
  const { t } = useI18n();
  const settings = useSettingsStore();
  const s = t.settings?.advanced;

  return (
    <>
      <header className={styles.sectionHeader}>
        <h2 className={styles.sectionTitle}>
          <span className={styles.sectionTitleIcon}>
            <Icon name="sliders" size="lg" />
          </span>
          {s?.title || 'Advanced'}
        </h2>
        <p className={styles.sectionSubtitle}>{s?.subtitle || 'Technical settings and tools'}</p>
      </header>

      {/* Network */}
      <div className={styles.settingsCard}>
        <div className={styles.cardHeader}>
          <h3 className={styles.cardTitle}>
            <Icon name="wifi" size="sm" />
            {s?.networkDiagnostics || 'Network'}
          </h3>
          <button className={styles.actionButton}>
            <Icon name="activity" size="sm" />
            {s?.runDiagnostics || 'Run Test'}
          </button>
        </div>
        <div className={styles.cardBody}>
          <div className={styles.settingItem}>
            <div className={styles.settingInfo}>
              <div className={styles.settingLabel}>{s?.connectionStatus || 'Status'}</div>
            </div>
            <div className={styles.settingControl}>
              <span className={`${styles.statusBadge} ${styles.statusEnabled}`}>
                <Icon name="wifi" size="xs" />
                Connected
              </span>
            </div>
          </div>

          <div className={styles.settingItem}>
            <div className={styles.settingInfo}>
              <div className={styles.settingLabel}>{s?.latencyTest || 'Latency'}</div>
            </div>
            <div className={styles.settingControl}>
              <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--color-success)' }}>
                23ms
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* WebSocket */}
      <div className={styles.settingsCard}>
        <div className={styles.cardHeader}>
          <h3 className={styles.cardTitle}>
            <Icon name="server" size="sm" />
            {s?.wsSettings || 'WebSocket'}
          </h3>
        </div>
        <div className={styles.cardBody}>
          <div className={styles.settingItem}>
            <div className={styles.settingInfo}>
              <div className={styles.settingLabel}>{s?.autoReconnect || 'Auto Reconnect'}</div>
            </div>
            <div className={styles.settingControl}>
              <button
                className={`${styles.toggle} ${settings.advanced.wsAutoReconnect ? styles.toggleActive : ''}`}
                onClick={() => settings.updateAdvanced({ wsAutoReconnect: !settings.advanced.wsAutoReconnect })}
              >
                <span className={styles.toggleKnob} />
              </button>
            </div>
          </div>

          <div className={styles.settingItem}>
            <div className={styles.settingInfo}>
              <div className={styles.settingLabel}>{s?.reconnectInterval || 'Reconnect Interval'}</div>
            </div>
            <div className={styles.settingControl}>
              <select
                className={styles.select}
                value={settings.advanced.wsReconnectInterval}
                onChange={(e) => settings.updateAdvanced({ wsReconnectInterval: parseInt(e.target.value) })}
              >
                <option value="3">3s</option>
                <option value="5">5s</option>
                <option value="10">10s</option>
                <option value="15">15s</option>
              </select>
            </div>
          </div>

          <div className={styles.settingItem}>
            <div className={styles.settingInfo}>
              <div className={styles.settingLabel}>{s?.heartbeatInterval || 'Heartbeat'}</div>
            </div>
            <div className={styles.settingControl}>
              <select
                className={styles.select}
                value={settings.advanced.wsHeartbeatInterval}
                onChange={(e) => settings.updateAdvanced({ wsHeartbeatInterval: parseInt(e.target.value) })}
              >
                <option value="15">15s</option>
                <option value="30">30s</option>
                <option value="60">60s</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* Cache */}
      <div className={styles.settingsCard}>
        <div className={styles.cardHeader}>
          <h3 className={styles.cardTitle}>
            <Icon name="hard-drive" size="sm" />
            {s?.cacheManagement || 'Cache'}
          </h3>
        </div>
        <div className={styles.cardBody}>
          <div className={styles.settingItem}>
            <div className={styles.settingInfo}>
              <div className={styles.settingLabel}>{s?.cacheSize || 'Cache Size'}</div>
            </div>
            <div className={styles.settingControl}>
              <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)' }}>
                12.4 MB
              </span>
            </div>
          </div>

          <div className={styles.settingItem}>
            <div className={styles.settingInfo}>
              <div className={styles.settingLabel}>{s?.clearCache || 'Clear Cache'}</div>
              <div className={styles.settingDescription}>{s?.cacheManagementDesc || 'Manage local data'}</div>
            </div>
            <div className={styles.settingControl}>
              <button className={styles.actionButton}>
                <Icon name="eraser" size="sm" />
                {s?.clearCache || 'Clear'}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Debug */}
      <div className={styles.settingsCard}>
        <div className={styles.cardHeader}>
          <h3 className={styles.cardTitle}>
            <Icon name="binary" size="sm" />
            {s?.debugMode || 'Debug'}
          </h3>
        </div>
        <div className={styles.cardBody}>
          <div className={styles.settingItem}>
            <div className={styles.settingInfo}>
              <div className={styles.settingLabel}>{s?.debugMode || 'Debug Mode'}</div>
              <div className={styles.settingDescription}>{s?.debugModeDesc || 'Enable detailed logging'}</div>
            </div>
            <div className={styles.settingControl}>
              <button
                className={`${styles.toggle} ${settings.advanced.debugMode ? styles.toggleActive : ''}`}
                onClick={() => settings.updateAdvanced({ debugMode: !settings.advanced.debugMode })}
              >
                <span className={styles.toggleKnob} />
              </button>
            </div>
          </div>

          <div className={styles.settingItem}>
            <div className={styles.settingInfo}>
              <div className={styles.settingLabel}>{s?.consoleLogging || 'Console Logging'}</div>
            </div>
            <div className={styles.settingControl}>
              <button
                className={`${styles.toggle} ${settings.advanced.consoleLogging ? styles.toggleActive : ''}`}
                onClick={() => settings.updateAdvanced({ consoleLogging: !settings.advanced.consoleLogging })}
              >
                <span className={styles.toggleKnob} />
              </button>
            </div>
          </div>

          <div className={styles.settingItem}>
            <div className={styles.settingInfo}>
              <div className={styles.settingLabel}>{s?.performanceMonitor || 'Performance'}</div>
            </div>
            <div className={styles.settingControl}>
              <button
                className={`${styles.toggle} ${settings.advanced.performanceMonitor ? styles.toggleActive : ''}`}
                onClick={() => settings.updateAdvanced({ performanceMonitor: !settings.advanced.performanceMonitor })}
              >
                <span className={styles.toggleKnob} />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Beta Features */}
      <div className={styles.settingsCard}>
        <div className={styles.cardHeader}>
          <h3 className={styles.cardTitle}>
            <Icon name="zap" size="sm" />
            {s?.experimentalFeatures || 'Experimental'}
          </h3>
          <span className={styles.statusBadge} style={{ background: 'var(--color-warning-bg)', color: 'var(--color-warning)' }}>
            BETA
          </span>
        </div>
        <div className={styles.cardBody}>
          <div className={styles.settingItem}>
            <div className={styles.settingInfo}>
              <div className={styles.settingLabel}>{s?.betaFeatures || 'Beta Features'}</div>
              <div className={styles.settingDescription}>{s?.experimentalFeaturesDesc || 'Features still in testing'}</div>
            </div>
            <div className={styles.settingControl}>
              <button
                className={`${styles.toggle} ${settings.advanced.experimentalFeatures ? styles.toggleActive : ''}`}
                onClick={() => settings.updateAdvanced({ experimentalFeatures: !settings.advanced.experimentalFeatures })}
              >
                <span className={styles.toggleKnob} />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Reset */}
      <div className={styles.settingsCard}>
        <div className={styles.cardHeader}>
          <h3 className={styles.cardTitle}>
            <Icon name="refresh-cw" size="sm" />
            {s?.resetSettings || 'Reset'}
          </h3>
        </div>
        <div className={styles.cardBody}>
          <div className={styles.settingItem}>
            <div className={styles.settingInfo}>
              <div className={styles.settingLabel}>{s?.resetSettings || 'Reset Settings'}</div>
              <div className={styles.settingDescription}>{s?.resetSettingsDesc || 'Restore all defaults'}</div>
            </div>
            <div className={styles.settingControl}>
              <button
                className={`${styles.actionButton} ${styles.actionButtonDanger}`}
                onClick={() => {
                  if (confirm(s?.resetConfirm || 'Are you sure?')) {
                    settings.resetAllSettings();
                  }
                }}
              >
                <Icon name="refresh-cw" size="sm" />
                {s?.resetSettings || 'Reset'}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Version Info */}
      <div className={styles.settingsCard}>
        <div className={styles.cardHeader}>
          <h3 className={styles.cardTitle}>
            <Icon name="info" size="sm" />
            {s?.version || 'Version'}
          </h3>
        </div>
        <div className={styles.cardBody}>
          <div className={styles.settingItem}>
            <div className={styles.settingInfo}>
              <div className={styles.settingLabel}>{s?.version || 'Version'}</div>
            </div>
            <div className={styles.settingControl}>
              <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)' }}>
                1.0.0
              </span>
            </div>
          </div>

          <div className={styles.settingItem}>
            <div className={styles.settingInfo}>
              <div className={styles.settingLabel}>{s?.buildNumber || 'Build'}</div>
            </div>
            <div className={styles.settingControl}>
              <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)' }}>
                2024.12.20
              </span>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
