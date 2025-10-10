// Initialize Sentry before everything else
import './sentry';
// Then load Expo Router
import 'expo-router/entry-classic';
// Configure notifications to show alerts in foreground during tests
try {
	const Notifications = require('expo-notifications');
	Notifications.setNotificationHandler({
		handleNotification: async () => ({
			shouldShowAlert: true,
			shouldPlaySound: false,
			shouldSetBadge: false,
		}),
	});
} catch {}
