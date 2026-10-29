import type { Messages } from './index'

/** English. Structure is checked against zh-CN (the source language). */
export const enUS: Messages = {
  common: {
    save: 'Save', saving: 'Saving…', saveChanges: 'Save changes', cancel: 'Cancel', retry: 'Retry', reload: 'Reload', close: 'Close',
    remove: 'Remove', removing: 'Removing…', on: 'On', off: 'Off', loading: 'Loading…', tryLater: 'Please try again later', networkError: 'Network error',
    operationFailed: 'Something went wrong. Please try again.', notOpenYet: 'Not available yet', collapse: 'Show less', travelerFallback: 'Traveler', meFallback: 'Traveler'
  },
  errors: {
    title: 'Something went wrong', body: 'The network may be unstable or the service is temporarily unavailable. Your data is safe.', retry: 'Try again', home: 'Back to home',
    notFoundTitle: 'Page not found', notFoundBody: 'The link may have expired, or the page has moved.'
  },
  nav: {
    home: 'Home', myTrips: 'My trips', createTrip: 'New trip', mapCheckin: 'Map & check-ins', photos: 'Photos', travelStory: 'Travel Story',
    explore: 'Explore', memories: 'Memories', settings: 'Settings', upgradePro: 'Upgrade to Trip Pro',
    upgradeProSub: 'Unlock more for your trips', taglineTop: 'Travel,', taglineBottom: 'and make every departure count.', mainNav: 'Main navigation', secondaryNav: 'More',
    newContent: 'New', closeNav: 'Close navigation', openNav: 'Open navigation', artwork: 'Travel illustration', brandHome: 'TabiTrace home'
  },
  header: {
    workspace: 'TABITRACE · TRAVEL MEMORY WORKSPACE', searchPlaceholder: 'Search places, plans, photos or trips…', searchLabel: 'Search places, plans, photos or trips',
    quickCheckin: 'Quick check-in', profile: 'Profile', accountSettings: 'Account settings', logout: 'Log out', hello: '{greeting}, {name}'
  },
  mobileNav: { label: 'Mobile navigation', home: 'Home', trips: 'Trips', checkin: 'Check in', checkinLabel: 'Quick check-in', share: 'Share', me: 'Me' },
  titles: {
    home: 'Home', trips: 'My trips', newTrip: 'New trip', map: 'Map & check-ins', photos: 'Photos', summary: 'Trip summary',
    share: 'Share', story: 'Travel Story', exploreTokyo: 'Explore Tokyo', explore: 'Explore cities', memories: 'Memories', pricing: 'Trip Pro',
    settings: 'Settings', fallback: 'TabiTrace'
  },
  tripNav: {
    label: 'Trip pages', overview: 'Overview', map: 'Map & check-ins', mapShort: 'Map', photos: 'Photos', summary: 'Summary',
    share: 'Share', shareShort: 'Share', video: 'Travel Story', videoShort: 'Story'
  },
  publicNav: {
    explore: 'Explore', features: 'Features', tokyo: 'Tokyo picks', pro: 'Trip Pro', login: 'Log in', start: 'Start a trip', myTrips: 'My trips',
    enterApp: 'Open TabiTrace', openMenu: 'Open menu', closeMenu: 'Close menu'
  },
  footer: {
    tagline: 'Record trips around the world — places, photos and stories you can come back to.', nav: 'Footer navigation',
    product: 'Product', features: 'Features', outcomes: 'Trip outputs', explore: 'Explore', officialExplore: 'Official guides', tokyo: 'Tokyo picks',
    account: 'Account', register: 'Sign up free', login: 'Log in', about: 'About', privacySoon: 'Privacy policy (coming soon)', termsSoon: 'Terms of service (coming soon)', credits: 'Image credits'
  },
  notify: {
    button: 'Notifications', buttonUnread: 'Notifications, {count} unread', list: 'Notification list', title: 'Notifications', count: '{count}',
    empty: 'No travel updates yet. Reminders will show up here after your first check-in.',
    storyDoneTitle: 'Travel Story is ready', storyDoneBody: '{template} template · {photos} photos',
    storyFailTitle: 'Travel Story failed', storyFailBody: 'You can generate it again on the Travel Story page',
    shareTitle: 'Your share link was opened {count} times', shareBody: 'Someone viewed your travel story',
    tripSoonTitle: '“{title}” starts soon', tripSoonBody: 'Departure: {date}',
    tripEndTitle: '“{title}” has ended', tripEndBody: 'Mark it as completed and create your trip outputs',
    limitPlaceTitle: 'Free check-ins almost used up', limitPlaceBody: '{count} places recorded, limit is 10',
    limitPhotoTitle: 'Free photo storage almost full', limitPhotoBody: '{count} photos saved, limit is 10'
  },
  settings: {
    eyebrow: 'PERSONAL SETTINGS', title: 'Settings', subtitle: 'Manage your profile, travel preferences, privacy and notifications.', loading: 'Loading settings',
    loadFailed: 'Settings failed to load', tabsLabel: 'Settings sections', saved: 'Settings saved', saveFailed: 'Could not save settings. Please try again.', fixFields: 'Please fix the highlighted fields first',
    tabs: { profile: 'Profile', preferences: 'Preferences', privacy: 'Privacy & sharing', notifications: 'Notifications', security: 'Account & security', pro: 'Trip Pro' },
    unsaved: {
      region: 'Unsaved changes', title: 'You have unsaved changes', count: '{count} changed', failed: 'Could not save settings. Please try again.', discard: 'Discard',
      leaveTitle: 'You have unsaved changes', leaveBody: 'Save these changes before leaving? If you discard them, your settings go back to what was last saved.', leaveDiscard: 'Discard changes'
    },
    summary: {
      label: 'Account overview', proTrips: 'TRIP PRO · {count} trips', trips: 'Trips', places: 'Places', photos: 'Photos', joined: 'Joined {month}/{year}',
      openProfile: 'View profile', openPro: 'Manage Trip Pro'
    },
    profile: {
      title: 'Profile', description: 'The name people see on your share pages, and how you appear in TabiTrace.',
      avatar: 'Avatar', avatarDesc: 'Shown in the top bar and the account overview.',
      nickname: 'Nickname', nicknameDesc: 'Share pages show “A TabiTrace story from your nickname”.',
      bio: 'Bio', bioDesc: 'One line about how you travel. Optional.', bioPlaceholder: 'e.g. I like to wander slowly and find a good coffee shop in every city.',
      email: 'Login email', emailDesc: 'Changing your login email requires account verification and isn’t available online yet.',
      nicknameRequired: 'Nickname can’t be empty', nicknameTooLong: 'Nickname can be at most {max} characters', bioTooLong: 'Bio can be at most {max} characters'
    },
    avatar: {
      upload: 'Upload avatar', change: 'Change avatar', uploading: 'Uploading…', hint: 'JPG, PNG or WebP. Cropped to a square automatically.', updated: 'Avatar updated', removed: 'Avatar removed',
      badType: 'Please choose a JPG, PNG or WebP image', tooLarge: 'Image is too large. Please choose one under 15 MB', uploadFailed: 'Avatar upload failed. Please try again', removeFailed: 'Could not remove avatar. Please try again',
      unsupported: 'Your browser can’t process images', processFailed: 'Image processing failed'
    },
    prefs: {
      title: 'Travel preferences', description: 'How TabiTrace organizes and displays your trips.',
      language: 'Interface language', languageDesc: 'Navigation, page titles, settings, notifications and dates switch right away; other pages are still being translated and may show Chinese. Your own trip titles and notes are never translated.',
      timezone: 'Time zone', timezoneDesc: 'Check-ins and photos are grouped into local days and times are shown in this time zone.',
      distance: 'Distance unit', distanceDesc: 'Used for distances on the map and in Explore.', km: 'Kilometers (km)', mi: 'Miles (mi)', deviceZone: '{zone} (this device)',
      invalidTimezone: 'Invalid time zone'
    },
    zones: {
      'Asia/Tokyo': 'Tokyo · Japan', 'Asia/Shanghai': 'Beijing / Shanghai · China', 'Asia/Hong_Kong': 'Hong Kong', 'Asia/Taipei': 'Taipei', 'Asia/Seoul': 'Seoul · South Korea',
      'Asia/Singapore': 'Singapore', 'Asia/Bangkok': 'Bangkok · Thailand', 'Europe/London': 'London · UK', 'Europe/Paris': 'Paris · France',
      'America/New_York': 'New York · US Eastern', 'America/Los_Angeles': 'Los Angeles · US Pacific', 'Australia/Sydney': 'Sydney · Australia', UTC: 'UTC'
    },
    privacy: {
      title: 'Privacy & sharing', description: 'What other people can see through your share links.',
      visibility: 'Default visibility for new trips', visibilityDesc: 'New trips are visible only to you. Creating a link on the Share page makes a trip “anyone with the link (UNLISTED)”; revoking all links makes it private again. TabiTrace has no public profile pages.',
      privateOnly: 'Only me · PRIVATE',
      exact: 'Show exact locations on share pages', exactDesc: 'When off, check-in coordinates on share pages are rounded to about 1 km: the route shape stays visible without revealing exact places like where you stayed.',
      expiry: 'Default share link expiry', expiryDesc: 'Applied automatically to new share links. Existing links are not affected.',
      expiryForever: 'Never expires', expiry7: 'Expires after 7 days', expiry30: 'Expires after 30 days'
    },
    notifications: {
      inApp: 'In-app notifications', inAppDesc: 'What appears in the bell notification center. Changes are saved immediately.', updated: 'Notification settings updated',
      trip: 'Trip reminders', tripDesc: 'When a trip is about to start, or has ended but isn’t wrapped up yet.',
      story: 'Travel Story', storyDesc: 'When a Travel Story finishes generating or fails.',
      share: 'Share activity', shareDesc: 'When someone opens your share link.',
      quotaNote: 'Reminders about running out of free quota always show, so check-ins or uploads don’t stop unexpectedly during a trip.',
      email: 'Email notifications', emailRow: 'Email reminders', emailDesc: 'TabiTrace doesn’t send travel notification emails yet (account security emails such as sign-up codes still arrive). A switch will appear here once they’re available.',
      emailOff: 'Not available yet'
    },
    security: {
      loginMethod: 'Sign-in method', loginEmail: 'Login email', loginEmailDesc: 'TabiTrace uses email and password. Third-party sign-in isn’t available yet.',
      password: 'Password', passwordDesc: 'After changing it, all other devices will need to log in again.', changePassword: 'Change password',
      passwordUpdated: 'Password updated', passwordUpdatedOthers: 'Password updated. Signed out of {count} other devices',
      devices: 'Signed-in devices', devicesDesc: 'A signed-out device loses access within 15 minutes.', signOutOthers: 'Sign out other devices ({count})',
      devicesFailed: 'Could not load signed-in devices: {error}', devicesLoading: 'Loading signed-in devices', currentDevice: 'This device',
      deviceTimes: 'Signed in {signedIn} · Last active {active}', signOut: 'Sign out', signingOut: 'Signing out…', signOutDevice: 'Sign out {device} (signed in {time})',
      showAllDevices: 'Show all {count} devices', signedOutDevice: 'Signed out {device}', signedOutOthers: 'Signed out of {count} other devices',
      logoutTitle: 'Log out', logoutRow: 'Log out of this account', logoutDesc: 'Only this device is logged out. Other devices stay signed in.', loggingOut: 'Logging out…',
      confirmOthersTitle: 'Sign out other devices?', confirmOthersBody: '{count} other devices will be signed out and need your password to log in again.',
      confirmLogoutTitle: 'Log out?', confirmLogoutBody: 'You’ll need to log in again to keep recording your trips.',
      currentPassword: 'Current password', newPassword: 'New password (at least {min} characters)', againPassword: 'Confirm new password', updatePassword: 'Update password',
      needCurrent: 'Enter your current password', tooShort: 'New password must be at least {min} characters', sameAsCurrent: 'New password must be different from the current one', mismatch: 'The new passwords don’t match',
      changeFailed: 'Could not change password. Please try again.',
      danger: 'Danger zone', deleteAccount: 'Delete account',
      deleteDesc: 'Deleting your account starts a 7-day cooling-off period: you are signed out everywhere and share links are paused; signing in again cancels it. After 7 days your trips, check-ins, photos, Travel Stories, share links, music and account are permanently deleted.',
      deleteButton: 'Delete account', deleteTitle: 'Delete your account?',
      deleteBody: 'What happens next:',
      deleteItem1: 'You are signed out on every device and your share links are paused',
      deleteItem2: 'Sign in with this email within {days} days to cancel the deletion',
      deleteItem3: 'After that, trips, check-ins, photos, Travel Stories, share links, your music, Trip Pro and membership are permanently deleted',
      deleteItem4: 'Payment records are kept as financial records but no longer linked to your account',
      deletePassword: 'Enter your password to confirm', deleteAck: 'I understand and want to delete my account',
      deleteSubmit: 'Delete account', deleting: 'Deleting…', deleteNeedPassword: 'Please enter your password', deleteNeedAck: 'Please tick the confirmation box'
    },
    pro: {
      description: 'A one-time purchase per trip ({price} per trip). Upgraded trips stay Pro forever — no subscription, no auto-renewal.', compare: 'Compare plans',
      hasPro: '{count} trips upgraded to Pro.', allFree: 'All your trips are on the free plan.', activeFree: 'Active free trips {active} / {limit} (archived trips don’t count)',
      empty: 'No trips yet. After creating your first trip you can upgrade it to Trip Pro here.', paid: 'Upgraded {date} · Paid {amount}', upgraded: 'Upgraded', mock: 'Test payment',
      upgradeTrip: 'Upgrade this trip', upgradeLabel: 'Upgrade “{title}” to Trip Pro',
      lifetimeOwned: 'Lifetime Pro is active: every trip on your account, now and in the future, is Pro.', lifetimeOffer: 'Travel often? Get Lifetime Pro ({price}) and every future trip is unlocked automatically.', lifetimeBuy: 'See Lifetime Pro',
      status: { PLANNING: 'Planning', ONGOING: 'Ongoing', COMPLETED: 'Completed', ARCHIVED: 'Archived' }
    }
  }
}
