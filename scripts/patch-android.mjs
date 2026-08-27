#!/usr/bin/env node
import { existsSync } from 'node:fs';
import { copyFile, mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const root = process.cwd();
const androidRoot = path.join(root, 'android');
if (!existsSync(androidRoot)) {
  console.error('Android project is missing. Run npm run android:add first.');
  process.exit(1);
}

const packagePath = path.join(androidRoot, 'app', 'src', 'main', 'java', 'com', 'actionanand', 'birthdaybuddy', 'app');
const resPath = path.join(androidRoot, 'app', 'src', 'main', 'res');
const stylesPath = path.join(resPath, 'values', 'styles.xml');
const nightStylesPath = path.join(resPath, 'values-night', 'styles.xml');
const xmlPath = path.join(resPath, 'xml');
const proguardPath = path.join(androidRoot, 'app', 'proguard-rules.pro');
await mkdir(packagePath, { recursive: true });
await mkdir(path.join(resPath, 'drawable'), { recursive: true });
await mkdir(path.join(resPath, 'drawable-nodpi'), { recursive: true });
await mkdir(path.join(resPath, 'values-night'), { recursive: true });
await mkdir(xmlPath, { recursive: true });

const manifestPath = path.join(androidRoot, 'app', 'src', 'main', 'AndroidManifest.xml');
let manifest = await readFile(manifestPath, 'utf8');
if (!manifest.includes('xmlns:tools='))
  manifest = manifest.replace(/<manifest([^>]*)>/, '<manifest$1 xmlns:tools="http://schemas.android.com/tools">');
const permissions = [
  'android.permission.READ_CONTACTS',
  'android.permission.CAMERA',
  'android.permission.USE_BIOMETRIC',
  'android.permission.POST_NOTIFICATIONS',
  'android.permission.RECEIVE_BOOT_COMPLETED',
]
  .filter(permission => !manifest.includes(permission))
  .map(permission => `    <uses-permission android:name="${permission}" />`)
  .join('\n');
if (permissions) manifest = manifest.replace('<application', `${permissions}\n\n    <application`);
if (!manifest.includes('SCHEDULE_EXACT_ALARM" tools:node="remove"'))
  manifest = manifest.replace(
    '<application',
    '    <uses-permission android:name="android.permission.SCHEDULE_EXACT_ALARM" tools:node="remove" />\n\n    <application',
  );
manifest = manifest
  .replace(/android:allowBackup="[^"]*"/g, 'android:allowBackup="false"')
  .replace(/android:fullBackupContent="[^"]*"/g, 'android:fullBackupContent="false"');
if (!manifest.includes('android:usesCleartextTraffic='))
  manifest = manifest.replace('<application', '<application android:usesCleartextTraffic="false"');
const notificationRestoreReceiver = `        <receiver android:name=".BirthdayBuddyNotificationRestoreReceiver" android:exported="false">
            <intent-filter>
                <action android:name="android.intent.action.MY_PACKAGE_REPLACED" />
                <action android:name="android.intent.action.TIME_SET" />
                <action android:name="android.intent.action.TIMEZONE_CHANGED" />
            </intent-filter>
        </receiver>`;
if (!manifest.includes('BirthdayBuddyNotificationRestoreReceiver'))
  manifest = manifest.replace('</application>', `${notificationRestoreReceiver}\n    </application>`);
await writeFile(manifestPath, manifest, 'utf8');

const gradlePath = path.join(androidRoot, 'app', 'build.gradle');
let gradle = await readFile(gradlePath, 'utf8');
if (!gradle.includes('androidx.biometric:biometric'))
  gradle = gradle.replace(
    /dependencies\s*\{/,
    'dependencies {\n    implementation "androidx.biometric:biometric:1.1.0"',
  );
gradle = gradle
  .replace(/minifyEnabled\s+false/, 'minifyEnabled true')
  .replace(
    /getDefaultProguardFile\(['"]proguard-android\.txt['"]\)/g,
    "getDefaultProguardFile('proguard-android-optimize.txt')",
  );
if (!gradle.includes('shrinkResources true'))
  gradle = gradle.replace(/minifyEnabled\s+true/, 'minifyEnabled true\n            shrinkResources true');
await writeFile(gradlePath, gradle, 'utf8');
if (!/minifyEnabled\s+true/.test(gradle) || !gradle.includes('shrinkResources true'))
  throw new Error(`Could not enable R8 release optimization in ${gradlePath}.`);
if (!/getDefaultProguardFile\(['"]proguard-android-optimize\.txt['"]\)/.test(gradle))
  throw new Error(`The optimized default ProGuard configuration is missing from ${gradlePath}.`);

const tinkAnnotationComment = `

# Google Tink references these JSR-305 and Error Prone annotations as build-time metadata. Android
# does not ship the annotation classes, and Tink does not require them at runtime.
`;
const tinkAnnotationRules = [
  '-dontwarn javax.annotation.Nullable',
  '-dontwarn javax.annotation.concurrent.GuardedBy',
  '-dontwarn com.google.errorprone.annotations.CanIgnoreReturnValue',
  '-dontwarn com.google.errorprone.annotations.CheckReturnValue',
  '-dontwarn com.google.errorprone.annotations.Immutable',
  '-dontwarn com.google.errorprone.annotations.RestrictedApi',
];
const capacitorAnnotationComment = `

# Capacitor discovers plugin permissions and callback methods through runtime annotations. Preserve
# both the annotation metadata and annotation interfaces when R8 optimization is enabled.
`;
const capacitorAnnotationRules = [
  '-keepattributes RuntimeVisibleAnnotations,RuntimeInvisibleAnnotations,AnnotationDefault',
  '-keep @interface com.getcapacitor.annotation.CapacitorPlugin',
  '-keep @interface com.getcapacitor.annotation.Permission',
  '-keep @interface com.getcapacitor.annotation.PermissionCallback',
  '-keep @interface com.getcapacitor.annotation.ActivityCallback',
  '-keep @interface com.getcapacitor.PluginMethod',
];
let proguardRules = existsSync(proguardPath) ? await readFile(proguardPath, 'utf8') : '';
if (!proguardRules.includes('# Google Tink references these JSR-305 and Error Prone annotations'))
  proguardRules = `${proguardRules.trimEnd()}${tinkAnnotationComment}`;
for (const annotationRule of tinkAnnotationRules) {
  if (!proguardRules.includes(annotationRule)) proguardRules = `${proguardRules.trimEnd()}\n${annotationRule}\n`;
}
if (!proguardRules.includes('# Capacitor discovers plugin permissions and callback methods'))
  proguardRules = `${proguardRules.trimEnd()}${capacitorAnnotationComment}`;
for (const annotationRule of capacitorAnnotationRules) {
  if (!proguardRules.includes(annotationRule)) proguardRules = `${proguardRules.trimEnd()}\n${annotationRule}\n`;
}
await writeFile(proguardPath, `${proguardRules.trimEnd()}\n`, 'utf8');
for (const annotationRule of [...tinkAnnotationRules, ...capacitorAnnotationRules]) {
  if (!proguardRules.includes(annotationRule))
    throw new Error(`Required R8 rule was not written to ${proguardPath}: ${annotationRule}`);
}

await writeFile(
  path.join(packagePath, 'MainActivity.java'),
  `package com.actionanand.birthdaybuddy.app;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
  @Override
  public void onCreate(Bundle savedInstanceState) {
    registerPlugin(BirthdayBuddyContactsPlugin.class);
    registerPlugin(BirthdayBuddyNotificationPermissionPlugin.class);
    registerPlugin(BirthdayBuddyFilesPlugin.class);
    registerPlugin(BirthdayBuddySecurityPlugin.class);
    super.onCreate(savedInstanceState);
  }
}
`,
  'utf8',
);

await writeFile(
  path.join(packagePath, 'BirthdayBuddyNotificationPermissionPlugin.java'),
  `package com.actionanand.birthdaybuddy.app;

import android.Manifest;
import android.content.pm.PackageManager;
import android.os.Build;
import androidx.activity.result.ActivityResultLauncher;
import androidx.activity.result.contract.ActivityResultContracts;
import androidx.core.content.ContextCompat;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "BirthdayBuddyNotificationPermission")
public class BirthdayBuddyNotificationPermissionPlugin extends Plugin {
  private ActivityResultLauncher<String> notificationPermissionLauncher;
  private PluginCall pendingPermissionCall;

  @Override
  public void load() {
    notificationPermissionLauncher = bridge.registerForActivityResult(
      new ActivityResultContracts.RequestPermission(),
      granted -> {
        PluginCall call = pendingPermissionCall;
        pendingPermissionCall = null;
        if (call != null) resolvePermission(call, granted || hasNotificationPermission());
      }
    );
  }

  @PluginMethod
  public void permissionStatus(PluginCall call) {
    resolvePermission(call, hasNotificationPermission());
  }

  @PluginMethod
  public void requestPermission(PluginCall call) {
    if (hasNotificationPermission()) {
      resolvePermission(call, true);
      return;
    }
    if (pendingPermissionCall != null) {
      call.reject("A notification permission request is already in progress.");
      return;
    }
    pendingPermissionCall = call;
    notificationPermissionLauncher.launch(Manifest.permission.POST_NOTIFICATIONS);
  }

  private boolean hasNotificationPermission() {
    return Build.VERSION.SDK_INT < Build.VERSION_CODES.TIRAMISU ||
      ContextCompat.checkSelfPermission(getContext(), Manifest.permission.POST_NOTIFICATIONS) ==
        PackageManager.PERMISSION_GRANTED;
  }

  private void resolvePermission(PluginCall call, boolean granted) {
    JSObject result = new JSObject();
    result.put("granted", granted);
    call.resolve(result);
  }
}
`,
  'utf8',
);

await writeFile(
  path.join(packagePath, 'BirthdayBuddyFilesPlugin.java'),
  `package com.actionanand.birthdaybuddy.app;

import android.app.Activity;
import android.content.Intent;
import android.net.Uri;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.ActivityCallback;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.io.OutputStream;
import java.nio.charset.StandardCharsets;

@CapacitorPlugin(name = "BirthdayBuddyFiles")
public class BirthdayBuddyFilesPlugin extends Plugin {
  @PluginMethod
  public void exportFile(PluginCall call) {
    String filename = call.getString("filename");
    String mimeType = call.getString("mimeType", "application/octet-stream");
    if (filename == null || call.getString("contents") == null) { call.reject("Filename and contents are required."); return; }
    Intent intent = new Intent(Intent.ACTION_CREATE_DOCUMENT);
    intent.addCategory(Intent.CATEGORY_OPENABLE);
    intent.setType(mimeType);
    intent.putExtra(Intent.EXTRA_TITLE, filename);
    startActivityForResult(call, intent, "fileCreated");
  }

  @ActivityCallback
  private void fileCreated(PluginCall call, androidx.activity.result.ActivityResult result) {
    if (call == null) return;
    JSObject response = new JSObject();
    if (result.getResultCode() != Activity.RESULT_OK || result.getData() == null || result.getData().getData() == null) {
      response.put("saved", false); call.resolve(response); return;
    }
    try (OutputStream output = getContext().getContentResolver().openOutputStream(result.getData().getData())) {
      if (output == null) throw new IllegalStateException("The selected file could not be opened.");
      output.write(call.getString("contents", "").getBytes(StandardCharsets.UTF_8));
      response.put("saved", true); call.resolve(response);
    } catch (Exception error) { call.reject("The backup could not be saved.", error); }
  }

  @PluginMethod
  public void pickFile(PluginCall call) {
    Intent intent = new Intent(Intent.ACTION_OPEN_DOCUMENT);
    intent.addCategory(Intent.CATEGORY_OPENABLE);
    intent.setType(call.getString("mimeType", "application/octet-stream"));
    startActivityForResult(call, intent, "filePicked");
  }

  @ActivityCallback
  private void filePicked(PluginCall call, androidx.activity.result.ActivityResult result) {
    if (call == null) return;
    if (result.getResultCode() != Activity.RESULT_OK || result.getData() == null || result.getData().getData() == null) { call.resolve(); return; }
    Uri uri = result.getData().getData();
    try (InputStream input = getContext().getContentResolver().openInputStream(uri); ByteArrayOutputStream output = new ByteArrayOutputStream()) {
      if (input == null) throw new IllegalStateException("The selected file could not be opened.");
      byte[] buffer = new byte[8192]; int count;
      while ((count = input.read(buffer)) > 0) output.write(buffer, 0, count);
      JSObject response = new JSObject(); response.put("contents", output.toString(StandardCharsets.UTF_8.name())); call.resolve(response);
    } catch (Exception error) { call.reject("The backup could not be opened.", error); }
  }
}
`,
  'utf8',
);

await writeFile(
  path.join(packagePath, 'BirthdayBuddyNotificationRestoreReceiver.java'),
  `package com.actionanand.birthdaybuddy.app;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import com.capacitorjs.plugins.localnotifications.LocalNotificationRestoreReceiver;

public class BirthdayBuddyNotificationRestoreReceiver extends BroadcastReceiver {
  @Override
  public void onReceive(Context context, Intent intent) {
    new LocalNotificationRestoreReceiver().onReceive(context, intent);
  }
}
`,
  'utf8',
);

await writeFile(
  path.join(packagePath, 'BirthdayBuddyContactsPlugin.java'),
  `package com.actionanand.birthdaybuddy.app;

import android.Manifest;
import android.app.Activity;
import android.content.Intent;
import android.database.Cursor;
import android.net.Uri;
import android.provider.ContactsContract;
import android.util.Base64;
import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import androidx.activity.result.ActivityResultLauncher;
import androidx.activity.result.contract.ActivityResultContracts;
import androidx.core.content.ContextCompat;
import com.getcapacitor.annotation.ActivityCallback;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.util.HashSet;
import java.util.Set;

@CapacitorPlugin(name = "BirthdayBuddyContacts")
public class BirthdayBuddyContactsPlugin extends Plugin {
  private ActivityResultLauncher<String> contactsPermissionLauncher;
  private PluginCall pendingContactsCall;

  @Override
  public void load() {
    contactsPermissionLauncher = bridge.registerForActivityResult(
      new ActivityResultContracts.RequestPermission(),
      granted -> {
        PluginCall call = pendingContactsCall;
        pendingContactsCall = null;
        if (call == null) return;
        if (granted) readAll(call); else call.reject("Contact permission was not granted.");
      }
    );
  }

  @PluginMethod
  public void permissionStatus(PluginCall call) {
    JSObject result = new JSObject(); result.put("granted", hasContactPermission()); call.resolve(result);
  }

  @PluginMethod
  public void pickContact(PluginCall call) {
    Intent intent = new Intent(Intent.ACTION_PICK, ContactsContract.Contacts.CONTENT_URI);
    startActivityForResult(call, intent, "contactPicked");
  }

  @ActivityCallback
  private void contactPicked(PluginCall call, androidx.activity.result.ActivityResult result) {
    if (call == null) return;
    if (result.getResultCode() != Activity.RESULT_OK || result.getData() == null || result.getData().getData() == null) { call.resolve(); return; }
    try {
      JSObject response = new JSObject(); response.put("contact", readSingle(result.getData().getData())); call.resolve(response);
    } catch (Exception error) { call.reject("The selected contact could not be read.", error); }
  }

  @PluginMethod
  public void readContacts(PluginCall call) {
    if (!hasContactPermission()) {
      if (pendingContactsCall != null) { call.reject("A contact permission request is already in progress."); return; }
      pendingContactsCall = call;
      contactsPermissionLauncher.launch(Manifest.permission.READ_CONTACTS);
      return;
    }
    readAll(call);
  }

  private boolean hasContactPermission() {
    return ContextCompat.checkSelfPermission(getContext(), Manifest.permission.READ_CONTACTS) == android.content.pm.PackageManager.PERMISSION_GRANTED;
  }

  private void readAll(PluginCall call) {
    try {
      JSArray contacts = new JSArray();
      JSArray lookupKeys = new JSArray();
      Set<String> linkedLookupKeys = new HashSet<>();
      JSArray linkedValues = call.getArray("linkedLookupKeys");
      if (linkedValues != null) for (int index = 0; index < linkedValues.length(); index++) linkedLookupKeys.add(linkedValues.optString(index));
      Cursor cursor = getContext().getContentResolver().query(ContactsContract.Contacts.CONTENT_URI, new String[] { ContactsContract.Contacts._ID, ContactsContract.Contacts.LOOKUP_KEY, ContactsContract.Contacts.DISPLAY_NAME_PRIMARY, ContactsContract.Contacts.PHOTO_THUMBNAIL_URI }, null, null, ContactsContract.Contacts.DISPLAY_NAME_PRIMARY + " COLLATE NOCASE");
      if (cursor != null) { while (cursor.moveToNext()) { String lookupKey = cursor.getString(1); lookupKeys.put(lookupKey); JSObject contact = contact(cursor.getString(0), lookupKey, cursor.getString(2), cursor.getString(3)); if (((JSArray) contact.get("events")).length() > 0 || linkedLookupKeys.contains(lookupKey)) contacts.put(contact); } cursor.close(); }
      JSObject response = new JSObject(); response.put("contacts", contacts); response.put("lookupKeys", lookupKeys); call.resolve(response);
    } catch (Exception error) { call.reject("Contacts could not be scanned.", error); }
  }

  private JSObject readSingle(Uri uri) throws Exception {
    Cursor cursor = getContext().getContentResolver().query(uri, new String[] { ContactsContract.Contacts._ID, ContactsContract.Contacts.LOOKUP_KEY, ContactsContract.Contacts.DISPLAY_NAME_PRIMARY, ContactsContract.Contacts.PHOTO_THUMBNAIL_URI }, null, null, null);
    if (cursor == null || !cursor.moveToFirst()) throw new IllegalStateException("Contact was not found.");
    JSObject result = contact(cursor.getString(0), cursor.getString(1), cursor.getString(2), cursor.getString(3)); cursor.close(); return result;
  }

  private JSObject contact(String id, String lookupKey, String name, String photoUri) {
    JSObject result = new JSObject(); result.put("lookupKey", lookupKey); result.put("displayName", name == null ? "Unnamed contact" : name); result.put("events", readEvents(id, lookupKey));
    String photo = readPhoto(photoUri); if (photo != null) result.put("photoData", photo); return result;
  }

  private JSArray readEvents(String contactId, String lookupKey) {
    JSArray events = new JSArray();
    String selection = ContactsContract.Data.CONTACT_ID + "=? AND " + ContactsContract.Data.MIMETYPE + "=?";
    Cursor cursor = getContext().getContentResolver().query(ContactsContract.Data.CONTENT_URI, new String[] { ContactsContract.Data._ID, ContactsContract.CommonDataKinds.Event.START_DATE, ContactsContract.CommonDataKinds.Event.TYPE }, selection, new String[] { contactId, ContactsContract.CommonDataKinds.Event.CONTENT_ITEM_TYPE }, null);
    if (cursor != null) { while (cursor.moveToNext()) { String dataId = cursor.getString(0); String raw = cursor.getString(1); int type = cursor.getInt(2); String label = type == ContactsContract.CommonDataKinds.Event.TYPE_BIRTHDAY ? "BIRTHDAY" : type == ContactsContract.CommonDataKinds.Event.TYPE_ANNIVERSARY ? "WEDDING_ANNIVERSARY" : null; int[] date = parseDate(raw); if (label != null && date != null) { JSObject event = new JSObject(); event.put("reference", lookupKey + ":event:" + dataId); event.put("type", label); event.put("month", date[1]); event.put("day", date[2]); if (date[0] > 0) event.put("year", date[0]); events.put(event); } } cursor.close(); }
    return events;
  }

  private int[] parseDate(String value) {
    if (value == null) return null;
    try { String clean = value.startsWith("--") ? value.substring(2) : value; String[] parts = clean.split("-"); if (parts.length == 2) return new int[] { 0, Integer.parseInt(parts[0]), Integer.parseInt(parts[1]) }; if (parts.length >= 3) return new int[] { Integer.parseInt(parts[0]), Integer.parseInt(parts[1]), Integer.parseInt(parts[2]) }; } catch (Exception ignored) { }
    return null;
  }

  private String readPhoto(String uri) {
    if (uri == null || uri.isEmpty()) return null;
    try (InputStream input = getContext().getContentResolver().openInputStream(Uri.parse(uri)); ByteArrayOutputStream output = new ByteArrayOutputStream()) { if (input == null) return null; byte[] buffer = new byte[8192]; int count; while ((count = input.read(buffer)) > 0) output.write(buffer, 0, count); return "data:image/jpeg;base64," + Base64.encodeToString(output.toByteArray(), Base64.NO_WRAP); } catch (Exception ignored) { return null; }
  }
}
`,
  'utf8',
);

await writeFile(
  path.join(packagePath, 'BirthdayBuddySecurityPlugin.java'),
  `package com.actionanand.birthdaybuddy.app;

import android.content.SharedPreferences;
import android.os.Build;
import android.security.keystore.KeyGenParameterSpec;
import android.security.keystore.KeyProperties;
import android.util.Base64;
import androidx.biometric.BiometricManager;
import androidx.biometric.BiometricPrompt;
import androidx.fragment.app.FragmentActivity;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.nio.charset.StandardCharsets;
import java.security.KeyStore;
import java.util.concurrent.Executor;
import javax.crypto.Cipher;
import javax.crypto.KeyGenerator;
import javax.crypto.SecretKey;
import javax.crypto.spec.GCMParameterSpec;

@CapacitorPlugin(name = "BirthdayBuddySecurity")
public class BirthdayBuddySecurityPlugin extends Plugin {
  private static final String STORE = "birthday_buddy_secure";
  private static final String STORAGE_ALIAS = "birthday_buddy_storage_key";
  private static final String BIOMETRIC_ALIAS = "birthday_buddy_biometric_key";
  private SharedPreferences preferences() { return getContext().getSharedPreferences(STORE, android.content.Context.MODE_PRIVATE); }

  @PluginMethod public void biometricStatus(PluginCall call) { JSObject result = new JSObject(); result.put("enabled", preferences().contains("biometric_secret") && preferences().contains("biometric_iv")); call.resolve(result); }

  @PluginMethod public void set(PluginCall call) { try { String key = call.getString("key"); String value = call.getString("value"); if (key == null || value == null) { call.reject("Key and value are required."); return; } Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding"); cipher.init(Cipher.ENCRYPT_MODE, storageKey()); byte[] encrypted = cipher.doFinal(value.getBytes(StandardCharsets.UTF_8)); preferences().edit().putString(key, Base64.encodeToString(encrypted, Base64.NO_WRAP)).putString(key + "_iv", Base64.encodeToString(cipher.getIV(), Base64.NO_WRAP)).apply(); call.resolve(); } catch (Exception error) { call.reject("Secret could not be stored.", error); } }
  @PluginMethod public void get(PluginCall call) { try { String key = call.getString("key"); String encrypted = preferences().getString(key, null); String iv = preferences().getString(key + "_iv", null); JSObject result = new JSObject(); if (encrypted != null && iv != null) { Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding"); cipher.init(Cipher.DECRYPT_MODE, loadKey(STORAGE_ALIAS), new GCMParameterSpec(128, Base64.decode(iv, Base64.DEFAULT))); result.put("value", new String(cipher.doFinal(Base64.decode(encrypted, Base64.DEFAULT)), StandardCharsets.UTF_8)); } call.resolve(result); } catch (Exception error) { call.reject("Secret could not be read.", error); } }
  @PluginMethod public void remove(PluginCall call) { String key = call.getString("key"); if (key != null) preferences().edit().remove(key).remove(key + "_iv").apply(); call.resolve(); }
  @PluginMethod public void enableBiometric(PluginCall call) { try { String secret = call.getString("secret"); if (secret == null) { call.reject("Secret is required."); return; } Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding"); cipher.init(Cipher.ENCRYPT_MODE, biometricKey()); authenticate("Enable biometric unlock", cipher, call, () -> { try { byte[] encrypted = cipher.doFinal(secret.getBytes(StandardCharsets.UTF_8)); preferences().edit().putString("biometric_secret", Base64.encodeToString(encrypted, Base64.NO_WRAP)).putString("biometric_iv", Base64.encodeToString(cipher.getIV(), Base64.NO_WRAP)).apply(); call.resolve(); } catch (Exception error) { call.reject("Biometric secret could not be saved.", error); } }); } catch (Exception error) { call.reject("Biometric unlock is unavailable.", error); } }
  @PluginMethod public void authenticateBiometric(PluginCall call) { try { String encrypted = preferences().getString("biometric_secret", null); String iv = preferences().getString("biometric_iv", null); if (encrypted == null || iv == null) { call.reject("Biometric unlock is not configured."); return; } Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding"); cipher.init(Cipher.DECRYPT_MODE, loadKey(BIOMETRIC_ALIAS), new GCMParameterSpec(128, Base64.decode(iv, Base64.DEFAULT))); authenticate("Unlock Birthday Buddy", cipher, call, () -> { try { JSObject result = new JSObject(); result.put("secret", new String(cipher.doFinal(Base64.decode(encrypted, Base64.DEFAULT)), StandardCharsets.UTF_8)); call.resolve(result); } catch (Exception error) { call.reject("Biometric secret could not be opened.", error); } }); } catch (Exception error) { call.reject("Biometric authentication failed.", error); } }
  @PluginMethod public void disableBiometric(PluginCall call) { try { preferences().edit().remove("biometric_secret").remove("biometric_iv").apply(); KeyStore store = KeyStore.getInstance("AndroidKeyStore"); store.load(null); if (store.containsAlias(BIOMETRIC_ALIAS)) store.deleteEntry(BIOMETRIC_ALIAS); call.resolve(); } catch (Exception error) { call.reject("Biometric unlock could not be disabled.", error); } }

  private SecretKey storageKey() throws Exception { try { return loadKey(STORAGE_ALIAS); } catch (Exception ignored) { KeyGenerator generator = KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES, "AndroidKeyStore"); generator.init(new KeyGenParameterSpec.Builder(STORAGE_ALIAS, KeyProperties.PURPOSE_ENCRYPT | KeyProperties.PURPOSE_DECRYPT).setBlockModes(KeyProperties.BLOCK_MODE_GCM).setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE).build()); return generator.generateKey(); } }
  private SecretKey biometricKey() throws Exception { KeyStore store = KeyStore.getInstance("AndroidKeyStore"); store.load(null); if (store.containsAlias(BIOMETRIC_ALIAS)) store.deleteEntry(BIOMETRIC_ALIAS); KeyGenerator generator = KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES, "AndroidKeyStore"); KeyGenParameterSpec.Builder builder = new KeyGenParameterSpec.Builder(BIOMETRIC_ALIAS, KeyProperties.PURPOSE_ENCRYPT | KeyProperties.PURPOSE_DECRYPT).setBlockModes(KeyProperties.BLOCK_MODE_GCM).setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE).setUserAuthenticationRequired(true).setInvalidatedByBiometricEnrollment(true); if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) builder.setUserAuthenticationParameters(0, KeyProperties.AUTH_BIOMETRIC_STRONG); else builder.setUserAuthenticationValidityDurationSeconds(-1); generator.init(builder.build()); return generator.generateKey(); }
  private SecretKey loadKey(String alias) throws Exception { KeyStore store = KeyStore.getInstance("AndroidKeyStore"); store.load(null); SecretKey key = (SecretKey) store.getKey(alias, null); if (key == null) throw new IllegalStateException("Secure key is missing."); return key; }
  private void authenticate(String title, Cipher cipher, PluginCall call, Runnable success) { FragmentActivity activity = (FragmentActivity) getActivity(); Executor executor = androidx.core.content.ContextCompat.getMainExecutor(getContext()); BiometricPrompt prompt = new BiometricPrompt(activity, executor, new BiometricPrompt.AuthenticationCallback() { @Override public void onAuthenticationSucceeded(BiometricPrompt.AuthenticationResult result) { success.run(); } @Override public void onAuthenticationError(int code, CharSequence message) { call.reject(message.toString()); } }); BiometricPrompt.PromptInfo info = new BiometricPrompt.PromptInfo.Builder().setTitle(title).setSubtitle("Confirm your identity on this device").setNegativeButtonText("Use PIN").setAllowedAuthenticators(BiometricManager.Authenticators.BIOMETRIC_STRONG).build(); prompt.authenticate(info, new BiometricPrompt.CryptoObject(cipher)); }
}
`,
  'utf8',
);

await writeFile(
  path.join(resPath, 'drawable', 'ic_stat_birthday_buddy.xml'),
  `<?xml version="1.0" encoding="utf-8"?><vector xmlns:android="http://schemas.android.com/apk/res/android" android:width="24dp" android:height="24dp" android:viewportWidth="24" android:viewportHeight="24"><path android:fillColor="#FFFFFFFF" android:pathData="M20,6h-2.18A3,3 0,0 0,12 5a3,3 0,0 0,-5.82 1H4a2,2 0,0 0,-2 2v2h9V8h2v2h9V8a2,2 0,0 0,-2 -2zM9,6a1,1 0,1 1,1 -1,1 1,0 0,1 -1,1zM15,6a1,1 0,1 1,1 -1,1 1,0 0,1 -1,1zM3,12v8a2,2 0,0 0,2 2h6V12zM13,12v10h6a2,2 0,0 0,2 -2v-8z"/></vector>`,
  'utf8',
);
await copyFile(
  path.join(root, 'src', 'assets', 'birthday-buddy.png'),
  path.join(resPath, 'drawable-nodpi', 'birthday_buddy_splash_logo.png'),
);
await writeFile(
  path.join(resPath, 'drawable', 'birthday_buddy_splash_icon.xml'),
  `<?xml version="1.0" encoding="utf-8"?>
<layer-list xmlns:android="http://schemas.android.com/apk/res/android">
    <item
        android:width="168dp"
        android:height="168dp"
        android:gravity="center"
        android:drawable="@drawable/birthday_buddy_splash_logo" />
</layer-list>
`,
  'utf8',
);
await writeFile(
  path.join(xmlPath, 'data_extraction_rules.xml'),
  `<?xml version="1.0" encoding="utf-8"?>
<data-extraction-rules>
  <cloud-backup><exclude domain="root" path="." /></cloud-backup>
  <device-transfer><exclude domain="root" path="." /></device-transfer>
</data-extraction-rules>
`,
  'utf8',
);
await writeFile(
  path.join(xmlPath, 'backup_rules.xml'),
  `<?xml version="1.0" encoding="utf-8"?>
<full-backup-content><exclude domain="root" path="." /></full-backup-content>
`,
  'utf8',
);

const ensureThemes = async (filePath, dark) => {
  await mkdir(path.dirname(filePath), { recursive: true });
  let styles = existsSync(filePath)
    ? await readFile(filePath, 'utf8')
    : '<?xml version="1.0" encoding="utf-8"?>\n<resources>\n</resources>\n';
  const background = dark ? '#121C17' : '#F6F3EC';
  const body = `    <style name="AppTheme.NoActionBar" parent="Theme.AppCompat.DayNight.NoActionBar">
        <item name="windowActionModeOverlay">true</item>
        <item name="android:windowNoTitle">true</item>
        <item name="android:windowBackground">${background}</item>
        <item name="android:statusBarColor">${background}</item>
        <item name="android:navigationBarColor">${background}</item>
        <item name="android:windowLightStatusBar">${dark ? 'false' : 'true'}</item>
        <item name="android:windowLightNavigationBar">${dark ? 'false' : 'true'}</item>
    </style>
    <style name="AppTheme.NoActionBarLaunch" parent="Theme.SplashScreen">
        <item name="windowSplashScreenBackground">#F6F3EC</item>
        <item name="windowSplashScreenAnimatedIcon">@drawable/birthday_buddy_splash_icon</item>
        <item name="windowSplashScreenIconBackgroundColor">@android:color/transparent</item>
        <item name="postSplashScreenTheme">@style/AppTheme.NoActionBar</item>
        <item name="android:statusBarColor">#F6F3EC</item>
        <item name="android:navigationBarColor">#F6F3EC</item>
        <item name="android:windowLightStatusBar">true</item>
        <item name="android:windowLightNavigationBar">true</item>
    </style>`;
  styles = styles.replace(/\s*<style name="AppTheme\.NoActionBar"[\s\S]*?<\/style>/g, '');
  styles = styles.replace(/\s*<style name="AppTheme\.NoActionBarLaunch"[\s\S]*?<\/style>/g, '');
  styles = styles.replace('</resources>', `${body}\n</resources>`);
  await writeFile(filePath, styles, 'utf8');
};
await ensureThemes(stylesPath, false);
await ensureThemes(nightStylesPath, true);

console.log(
  'Applied Birthday Buddy Android contacts, document backup, Keystore security, recurring notification, 168dp splash, privacy, system-bar and release patches.',
);
