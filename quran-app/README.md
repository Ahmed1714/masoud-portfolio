# تطبيق تحفيظ القرآن الكريم مع الشيخ عبد الباسط

تطبيق أندرويد احترافي لحفظ القرآن الكريم بصوت الشيخ عبد الباسط عبد الصمد

## المميزات

### 📖 وضع الاستماع
- تشغيل تلاوة الشيخ عبد الباسط (مرتّل أو مجوّد)
- تحكم كامل: تشغيل، إيقاف، التالي، السابق
- تسليط الضوء على الآية الحالية مع التمرير التلقائي
- التحكم في سرعة التلاوة (0.5x إلى 1.5x)
- أوضاع التكرار: مفرد / كل السورة / بدون تكرار

### 📚 وضع الحفظ
- عرض آية آية مع تتبع التقدم
- زر إخفاء/إظهار النص لاختبار الذاكرة
- تصنيف كل آية: لم أحفظ / قيد الحفظ / محفوظة
- الاستماع للآية الحالية مرجعاً صوتياً

### 🎙️ وضع التسميع
- اقرأ الآية من الذاكرة
- أظهر النص للتصحيح
- قيّم أداءك: ✅ صحيح / 🟡 مقبول / ❌ خطأ
- تقرير تفصيلي في نهاية كل جلسة تسميع
- حفظ النتائج تلقائياً في قاعدة البيانات

### 📊 التقدم
- إحصائيات شاملة: آيات محفوظة، سور مكتملة
- شريط تقدم الحفظ العام
- نصائح ذهبية للحفظ الفعّال

## التقنيات المستخدمة

| التقنية | الاستخدام |
|---------|-----------|
| Kotlin + Jetpack Compose | واجهة المستخدم الحديثة |
| Media3 / ExoPlayer | تشغيل الصوت |
| Room Database | حفظ التقدم محلياً |
| Retrofit + OkHttp | استدعاء API القرآن |
| Hilt | حقن الاعتمادات |
| MVVM Architecture | تنظيم الكود |

## API المستخدم

- **النصوص:** `https://api.alquran.cloud/v1/` (رواية حفص عن عاصم)
- **الصوت:** `https://cdn.islamic.network/quran/audio/128/ar.abdulbasitmurattal/{رقم الآية}.mp3`

## طريقة البناء والتثبيت

### المتطلبات
- Android Studio Hedgehog (2023.1.1) أو أحدث
- JDK 17
- Android SDK 34
- هاتف أندرويد 8.0+ أو محاكي

### خطوات البناء

```bash
# 1. افتح المجلد في Android Studio
File > Open > quran-app/

# 2. انتظر تحميل Gradle (أول مرة يأخذ وقتاً)

# 3. ابنِ APK
Build > Build Bundle(s) / APK(s) > Build APK(s)

# 4. ستجد الـ APK في:
app/build/outputs/apk/debug/app-debug.apk
```

### تثبيت APK مباشرة

```bash
# عبر ADB (مع تفعيل USB Debugging)
adb install app/build/outputs/apk/debug/app-debug.apk
```

## هيكل المشروع

```
quran-app/
├── app/src/main/java/com/quranapp/memorization/
│   ├── data/
│   │   ├── api/           # Retrofit API service + models
│   │   ├── db/            # Room entities, DAOs, Database
│   │   └── repository/    # QuranRepository (single source of truth)
│   ├── di/                # Hilt dependency injection
│   ├── service/           # Media3 playback service
│   ├── ui/
│   │   ├── navigation/    # App navigation graph
│   │   ├── screens/       # 6 screens
│   │   ├── theme/         # Colors, Typography, Theme
│   │   └── viewmodels/    # MVVM ViewModels
│   ├── MainActivity.kt
│   └── QuranApp.kt
└── app/src/main/res/
    ├── drawable/
    └── values/
```

## الشاشات

1. **الرئيسية** - قائمة السور مع البحث والإحصائيات
2. **تفاصيل السورة** - آيات السورة مع أزرار الأوضاع
3. **الاستماع** - مشغل صوتي كامل المواصفات
4. **الحفظ** - وضع الدراسة آية آية
5. **التسميع** - جلسة اختبار مع تقرير النتائج
6. **التقدم** - لوحة الإحصائيات

---

بالتوفيق في حفظ كتاب الله العزيز 🌿
