# Laravel Migration Files - Booking System

## Migration Order and Files

Execute these migrations in the order listed below.

---

## 1. Create Companies Table

**File:** `2024_01_01_000001_create_companies_table.php`

```php
<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('companies', function (Blueprint $table) {
            $table->id();
            $table->string('company_name')->unique();
            $table->string('email')->unique();
            $table->string('phone');
            $table->text('address');
            $table->integer('total_locations')->default(0);
            $table->integer('total_employees')->default(0);
            // $table->enum('subscription_plan', ['basic', 'premium', 'enterprise'])->default('basic');
            // $table->enum('subscription_status', ['active', 'inactive', 'trial'])->default('trial');
            $table->timestamps();
            
            // Indexes
            $table->index('subscription_status');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('companies');
    }
};
```

---

## 2. Create Locations Table

**File:** `2024_01_01_000002_create_locations_table.php`

```php
<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('locations', function (Blueprint $table) {
            $table->id();
            $table->foreignId('company_id')->constrained()->onDelete('cascade');
            $table->string('name');
            $table->string('address');
            $table->string('city');
            $table->string('state');
            $table->string('zip_code');
            $table->string('phone');
            $table->string('email');
            $table->string('timezone')->default('UTC');
            $table->boolean('is_active')->default(true);
            $table->timestamps();
            
            // Indexes
            $table->index('company_id');
            $table->index('is_active');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('locations');
    }
};
```

---

## 3. Create Users Table

**File:** `2024_01_01_000003_create_users_table.php`

```php
<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('users', function (Blueprint $table) {
            $table->id();
            $table->foreignId('company_id')->nullable()->constrained()->onDelete('cascade');
            $table->foreignId('location_id')->nullable()->constrained()->onDelete('set null');
            $table->string('first_name');
            $table->string('last_name');
            $table->string('email')->unique();
            $table->string('phone')->nullable();
            $table->string('password');
            $table->enum('role', ['company_admin', 'location_manager', 'attendant']);
            $table->string('employee_id')->unique()->nullable();
            $table->string('department')->nullable();
            $table->string('position')->nullable();
            $table->string('shift')->nullable();
            $table->json('assigned_areas')->nullable();
            $table->date('hire_date')->nullable();
            $table->enum('status', ['active', 'inactive'])->default('active');
            $table->timestamp('last_login')->nullable();
            $table->timestamp('email_verified_at')->nullable();
            $table->string('invitation_token')->nullable();
            $table->timestamp('invitation_expiry')->nullable();
            $table->rememberToken();
            $table->timestamps();
            
            // Indexes
            $table->index(['company_id', 'location_id']);
            $table->index(['role', 'status']);
            $table->index('email');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('users');
    }
};
```

---

## 4. Create Customers Table

**File:** `2024_01_01_000004_create_customers_table.php`

```php
<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('customers', function (Blueprint $table) {
            $table->id();
            $table->string('first_name');
            $table->string('last_name');
            $table->string('email')->unique();
            $table->string('phone');
            $table->string('password');
            $table->date('date_of_birth')->nullable();
            $table->integer('total_bookings')->default(0);
            $table->decimal('total_spent', 10, 2)->default(0);
            $table->timestamp('last_visit')->nullable();
            $table->enum('status', ['active', 'inactive'])->default('active');
            $table->timestamp('email_verified_at')->nullable();
            $table->rememberToken();
            $table->timestamps();
            
            // Indexes
            $table->index('email');
            $table->index('status');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('customers');
    }
};
```

---

## 5. Create Packages Table

**File:** `2024_01_01_000005_create_packages_table.php`

```php
<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('packages', function (Blueprint $table) {
            $table->id();
            $table->foreignId('location_id')->constrained()->onDelete('cascade');
            $table->string('name');
            $table->text('description');
            $table->string('category');
            $table->text('features')->nullable();
            $table->decimal('price', 10, 2);
            $table->decimal('price_per_additional', 10, 2)->nullable();
            $table->integer('max_participants');
            $table->integer('duration');
            $table->enum('duration_unit', ['hours', 'minutes'])->default('hours');
            $table->decimal('price_per_additional_30min', 10, 2)->nullable();
            $table->decimal('price_per_additional_1hr', 10, 2)->nullable();
            $table->enum('availability_type', ['daily', 'weekly', 'monthly'])->default('daily');
            $table->json('available_days')->nullable();
            $table->json('available_week_days')->nullable();
            $table->json('available_month_days')->nullable();
            $table->string('image')->nullable();
            $table->boolean('is_active')->default(true);
            $table->timestamps();
            
            // Indexes
            $table->index('location_id');
            $table->index('category');
            $table->index('is_active');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('packages');
    }
};
```

---

## 6. Create Attractions Table

**File:** `2024_01_01_000006_create_attractions_table.php`

```php
<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('attractions', function (Blueprint $table) {
            $table->id();
            $table->foreignId('location_id')->constrained()->onDelete('cascade');
            $table->string('name');
            $table->text('description');
            $table->decimal('price', 10, 2);
            $table->string('pricing_type')->default('per_person');
            $table->integer('max_capacity');
            $table->string('category');
            $table->string('unit')->nullable();
            $table->integer('duration')->nullable();
            $table->enum('duration_unit', ['hours', 'minutes'])->nullable();
            $table->json('availability')->nullable();
            $table->string('image')->nullable();
            $table->decimal('rating', 3, 2)->nullable();
            $table->integer('min_age')->nullable();
            $table->boolean('is_active')->default(true);
            $table->timestamps();
            
            // Indexes
            $table->index('location_id');
            $table->index('category');
            $table->index('is_active');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('attractions');
    }
};
```

---

## 7. Create Rooms Table

**File:** `2024_01_01_000007_create_rooms_table.php`

```php
<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('rooms', function (Blueprint $table) {
            $table->id();
            $table->foreignId('location_id')->constrained()->onDelete('cascade');
            $table->string('name');
            $table->integer('capacity')->nullable();
            $table->boolean('is_available')->default(true);
            $table->timestamps();
            
            // Indexes
            $table->index('location_id');
            $table->index('is_available');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('rooms');
    }
};
```

---

## 8. Create Add-ons Table

**File:** `2024_01_01_000008_create_add_ons_table.php`

```php
<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('add_ons', function (Blueprint $table) {
            $table->id();
            $table->foreignId('location_id')->nullable()->constrained()->onDelete('cascade');
            $table->string('name');
            $table->decimal('price', 10, 2);
            $table->text('description')->nullable();
            $table->string('image')->nullable();
            $table->boolean('is_active')->default(true);
            $table->timestamps();
            
            // Indexes
            $table->index('location_id');
            $table->index('is_active');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('add_ons');
    }
};
```

---

## 9. Create Gift Cards Table

**File:** `2024_01_01_000009_create_gift_cards_table.php`

```php
<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('gift_cards', function (Blueprint $table) {
            $table->id();
            $table->string('code')->unique();
            $table->enum('type', ['fixed', 'percentage'])->default('fixed');
            $table->decimal('initial_value', 10, 2);
            $table->decimal('balance', 10, 2);
            $table->integer('max_usage')->default(1);
            $table->text('description')->nullable();
            $table->enum('status', ['active', 'inactive', 'expired', 'redeemed', 'cancelled', 'deleted'])->default('active');
            $table->date('expiry_date')->nullable();
            $table->foreignId('created_by')->constrained('users')->onDelete('cascade');
            $table->boolean('deleted')->default(false);
            $table->timestamps();
            
            // Indexes
            $table->index('code');
            $table->index('status');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('gift_cards');
    }
};
```

---

## 10. Create Promos Table

**File:** `2024_01_01_000010_create_promos_table.php`

```php
<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('promos', function (Blueprint $table) {
            $table->id();
            $table->string('code')->unique();
            $table->string('name');
            $table->enum('type', ['fixed', 'percentage'])->default('percentage');
            $table->decimal('value', 10, 2);
            $table->date('start_date');
            $table->date('end_date');
            $table->integer('usage_limit_total')->nullable();
            $table->integer('usage_limit_per_user')->default(1);
            $table->integer('current_usage')->default(0);
            $table->enum('status', ['active', 'inactive', 'expired', 'exhausted'])->default('active');
            $table->text('description')->nullable();
            $table->foreignId('created_by')->constrained('users')->onDelete('cascade');
            $table->boolean('deleted')->default(false);
            $table->timestamps();
            
            // Indexes
            $table->index('code');
            $table->index('status');
            $table->index(['start_date', 'end_date']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('promos');
    }
};
```

---

## 11. Create Bookings Table

**File:** `2024_01_01_000011_create_bookings_table.php`

```php
<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('bookings', function (Blueprint $table) {
            $table->id();
            $table->string('reference_number')->unique();
            $table->foreignId('customer_id')->constrained()->onDelete('cascade');
            $table->foreignId('package_id')->nullable()->constrained()->onDelete('set null');
            $table->foreignId('location_id')->constrained()->onDelete('cascade');
            $table->foreignId('room_id')->nullable()->constrained()->onDelete('set null');
            $table->foreignId('created_by')->nullable()->constrained('users')->onDelete('set null');
            $table->foreignId('gift_card_id')->nullable()->constrained()->onDelete('set null');
            $table->foreignId('promo_id')->nullable()->constrained()->onDelete('set null');
            $table->enum('type', 'package');
            $table->date('booking_date');
            $table->time('booking_time');
            $table->integer('participants');
            $table->integer('duration');
            $table->enum('duration_unit', ['hours', 'minutes'])->default('hours');
            $table->decimal('total_amount', 10, 2);
            $table->decimal('amount_paid', 10, 2)->default(0);
            $table->decimal('discount_amount', 10, 2)->nullable();
            $table->enum('payment_method', ['credit', 'debit', 'cash'])->nullable();
            $table->enum('payment_status', ['paid', 'partial'])
            $table->enum('status', ['pending', 'confirmed', 'checked-in', 'completed', 'cancelled'])->default('pending');
            $table->text('notes')->nullable();
            $table->text('special_requests')->nullable();
            $table->timestamp('checked_in_at')->nullable();
            $table->timestamp('completed_at')->nullable();
            $table->timestamp('cancelled_at')->nullable();
            $table->timestamps();
            
            // Indexes
            $table->index('customer_id');
            $table->index('location_id');
            $table->index('status');
            $table->index(['booking_date', 'booking_time']);
            $table->index('reference_number');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('bookings');
    }
};
```

---

## 12. Create Booking Attractions Table (Pivot)

**File:** `2024_01_01_000012_create_booking_attractions_table.php`

```php
<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('booking_attractions', function (Blueprint $table) {
            $table->id();
            $table->foreignId('booking_id')->constrained()->onDelete('cascade');
            $table->foreignId('attraction_id')->constrained()->onDelete('cascade');
            $table->integer('quantity')->default(1);
            $table->decimal('price_at_booking', 10, 2);
            $table->timestamps();
            
            // Indexes
            $table->index('booking_id');
            $table->index('attraction_id');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('booking_attractions');
    }
};
```

---

## 13. Create Booking Add-ons Table (Pivot)

**File:** `2024_01_01_000013_create_booking_add_ons_table.php`

```php
<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('booking_add_ons', function (Blueprint $table) {
            $table->id();
            $table->foreignId('booking_id')->constrained()->onDelete('cascade');
            $table->foreignId('add_on_id')->constrained()->onDelete('cascade');
            $table->integer('quantity')->default(1);
            $table->decimal('price_at_booking', 10, 2);
            $table->timestamps();
            
            // Indexes
            $table->index('booking_id');
            $table->index('add_on_id');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('booking_add_ons');
    }
};
```

---

## 14. Create Package Attractions Table (Pivot)

**File:** `2024_01_01_000014_create_package_attractions_table.php`

```php
<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('package_attractions', function (Blueprint $table) {
            $table->id();
            $table->foreignId('package_id')->constrained()->onDelete('cascade');
            $table->foreignId('attraction_id')->constrained()->onDelete('cascade');
            $table->timestamps();
            
            // Indexes
            $table->index('package_id');
            $table->index('attraction_id');
            
            // Unique constraint to prevent duplicates
            $table->unique(['package_id', 'attraction_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('package_attractions');
    }
};
```

---

## 15. Create Package Add-ons Table (Pivot)

**File:** `2024_01_01_000015_create_package_add_ons_table.php`

```php
<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('package_add_ons', function (Blueprint $table) {
            $table->id();
            $table->foreignId('package_id')->constrained()->onDelete('cascade');
            $table->foreignId('add_on_id')->constrained()->onDelete('cascade');
            $table->timestamps();
            
            // Indexes
            $table->index('package_id');
            $table->index('add_on_id');
            
            // Unique constraint to prevent duplicates
            $table->unique(['package_id', 'add_on_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('package_add_ons');
    }
};
```

---

## 16. Create Package Gift Cards Table (Pivot)

**File:** `2024_01_01_000016_create_package_gift_cards_table.php`

```php
<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('package_gift_cards', function (Blueprint $table) {
            $table->id();
            $table->foreignId('package_id')->constrained()->onDelete('cascade');
            $table->foreignId('gift_card_id')->constrained()->onDelete('cascade');
            $table->timestamps();
            
            // Indexes
            $table->index('package_id');
            $table->index('gift_card_id');
            
            // Unique constraint to prevent duplicates
            $table->unique(['package_id', 'gift_card_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('package_gift_cards');
    }
};
```

---

## 17. Create Package Promos Table (Pivot)

**File:** `2024_01_01_000017_create_package_promos_table.php`

```php
<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('package_promos', function (Blueprint $table) {
            $table->id();
            $table->foreignId('package_id')->constrained()->onDelete('cascade');
            $table->foreignId('promo_id')->constrained()->onDelete('cascade');
            $table->timestamps();
            
            // Indexes
            $table->index('package_id');
            $table->index('promo_id');
            
            // Unique constraint to prevent duplicates
            $table->unique(['package_id', 'promo_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('package_promos');
    }
};
```

---

## 18. Create Package Rooms Table (Pivot)

**File:** `2024_01_01_000018_create_package_rooms_table.php`

```php
<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('package_rooms', function (Blueprint $table) {
            $table->id();
            $table->foreignId('package_id')->constrained()->onDelete('cascade');
            $table->foreignId('room_id')->constrained()->onDelete('cascade');
            $table->timestamps();
            
            // Indexes
            $table->index('package_id');
            $table->index('room_id');
            
            // Unique constraint to prevent duplicates
            $table->unique(['package_id', 'room_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('package_rooms');
    }
};
```

---

## 19. Create Customer Gift Cards Table

**File:** `2024_01_01_000019_create_customer_gift_cards_table.php`

```php
<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('customer_gift_cards', function (Blueprint $table) {
            $table->id();
            $table->foreignId('customer_id')->constrained()->onDelete('cascade');
            $table->foreignId('gift_card_id')->constrained()->onDelete('cascade');
            $table->boolean('redeemed')->default(false);
            $table->timestamp('redeemed_at')->nullable();
            $table->timestamps();
            
            // Indexes
            $table->index('customer_id');
            $table->index('gift_card_id');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('customer_gift_cards');
    }
};
```

---

## 20. Create Reservations Table

**File:** `2024_01_01_000020_create_reservations_table.php`

```php
<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('reservations', function (Blueprint $table) {
            $table->id();
            $table->string('reference_number')->unique();
            $table->foreignId('customer_id')->constrained()->onDelete('cascade');
            $table->foreignId('package_id')->constrained()->onDelete('cascade');
            $table->foreignId('location_id')->constrained()->onDelete('cascade');
            $table->date('booking_date');
            $table->time('booking_time');
            $table->integer('participants_count');
            $table->decimal('total_amount', 10, 2);
            $table->enum('status', ['confirmed', 'pending', 'cancelled', 'refunded'])->default('pending');
            $table->string('payment_id');
            $table->text('special_requests')->nullable();
            $table->timestamps();
            
            // Indexes
            $table->index('customer_id');
            $table->index('location_id');
            $table->index('status');
            $table->index('reference_number');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('reservations');
    }
};
```

---

## 21. Create Payments Table

**File:** `2024_01_01_000021_create_payments_table.php`

```php
<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('payments', function (Blueprint $table) {
            $table->id();
            $table->foreignId('booking_id')->nullable()->constrained()->onDelete('cascade');
            $table->foreignId('customer_id')->constrained()->onDelete('cascade');
            $table->string('transaction_id')->unique();
            $table->decimal('amount', 10, 2);
            $table->string('currency', 3)->default('USD');
            $table->enum('method', ['credit', 'debit', 'cash', 'e-wallet', 'bank_transfer']);
            $table->enum('status', ['pending', 'completed', 'failed', 'refunded'])->default('pending');
            $table->text('notes')->nullable();
            $table->timestamp('paid_at')->nullable();
            $table->timestamp('refunded_at')->nullable();
            $table->timestamps();
            
            // Indexes
            $table->index('booking_id');
            $table->index('customer_id');
            $table->index('transaction_id');
            $table->index('status');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('payments');
    }
};
```

---

## 22. Create Attraction Purchases Table

**File:** `2024_01_01_000022_create_attraction_purchases_table.php`

```php
<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('attraction_purchases', function (Blueprint $table) {
            $table->id();
            $table->foreignId('attraction_id')->constrained()->onDelete('cascade');
            $table->foreignId('customer_id')->nullable()->constrained()->onDelete('cascade');
            $table->foreignId('created_by')->nullable()->constrained('users')->onDelete('set null');
            
            // Guest customer fields (for purchases without login)
            $table->string('guest_name')->nullable();
            $table->string('guest_email')->nullable();
            $table->string('guest_phone')->nullable();
            
            $table->integer('quantity')->default(1);
            $table->decimal('total_amount', 10, 2);
            $table->enum('payment_method', ['credit', 'debit', 'cash', 'e-wallet', 'bank_transfer']);
            $table->enum('status', ['pending', 'completed', 'cancelled'])->default('pending');
            $table->date('purchase_date');
            $table->text('notes')->nullable();
            $table->timestamps();

            // Indexes
            $table->index('attraction_id');
            $table->index('customer_id');
            $table->index('guest_email');
            $table->index('status');
            $table->index('purchase_date');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('attraction_purchases');
    }
};
```

---

## 23. Create Notifications Table

**File:** `2024_01_01_000023_create_notifications_table.php`

```php
<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('notifications', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->nullable()->constrained()->onDelete('cascade');
            $table->foreignId('customer_id')->nullable()->constrained()->onDelete('cascade');
            $table->enum('user_type', ['admin', 'customer']);
            $table->enum('type', ['system', 'booking', 'payment', 'staff', 'customer', 'promotion', 'gift_card', 'reminder']);
            $table->enum('priority', ['low', 'medium', 'high', 'urgent'])->nullable();
            $table->string('title');
            $table->text('message');
            $table->enum('status', ['unread', 'read', 'archived'])->default('unread');
            $table->string('action_url')->nullable();
            $table->string('action_text')->nullable();
            $table->json('metadata')->nullable();
            $table->string('related_user')->nullable();
            $table->string('related_location')->nullable();
            $table->timestamp('read_at')->nullable();
            $table->timestamps();
            
            // Indexes
            $table->index(['user_id', 'user_type']);
            $table->index('customer_id');
            $table->index('status');
            $table->index('type');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('notifications');
    }
};
```

---

## 24. Create Activity Logs Table

**File:** `2024_01_01_000024_create_activity_logs_table.php`

```php
<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('activity_logs', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->nullable()->constrained()->onDelete('set null');
            $table->foreignId('location_id')->nullable()->constrained()->onDelete('set null');
            $table->string('action');
            $table->text('details');
            $table->string('ip_address')->nullable();
            $table->text('user_agent')->nullable();
            $table->timestamps();
            
            // Indexes
            $table->index('user_id');
            $table->index('location_id');
            $table->index('created_at');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('activity_logs');
    }
};
```

---

## Additional Useful Migrations

### 25. Create Password Reset Tokens Table

**File:** `2024_01_01_000025_create_password_reset_tokens_table.php`

```php
<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('password_reset_tokens', function (Blueprint $table) {
            $table->string('email')->primary();
            $table->string('token');
            $table->timestamp('created_at')->nullable();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('password_reset_tokens');
    }
};
```

---

### 26. Create Sessions Table (for database session driver)

**File:** `2024_01_01_000026_create_sessions_table.php`

```php
<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('sessions', function (Blueprint $table) {
            $table->string('id')->primary();
            $table->foreignId('user_id')->nullable()->index();
            $table->string('ip_address', 45)->nullable();
            $table->text('user_agent')->nullable();
            $table->longText('payload');
            $table->integer('last_activity')->index();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('sessions');
    }
};
```

---

### 27. Create Personal Access Tokens Table (for API authentication)

**File:** `2024_01_01_000027_create_personal_access_tokens_table.php`

```php
<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('personal_access_tokens', function (Blueprint $table) {
            $table->id();
            $table->morphs('tokenable');
            $table->string('name');
            $table->string('token', 64)->unique();
            $table->text('abilities')->nullable();
            $table->timestamp('last_used_at')->nullable();
            $table->timestamp('expires_at')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('personal_access_tokens');
    }
};


<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::create('access_shareable_tokens', function (Blueprint $table) {
            $table->id();
            $table->string('token', 64)->unique();
            $table->string('email')->nullable();
            $table->enum('role', ['company_admin', 'location_manager', 'attendant'])->default('attendant');
            $table->foreignId('created_by')->nullable()->constrained('users')->onDelete('set null');
            $table->timestamp('used_at')->nullable();
            $table->boolean('is_active')->default(true);
            $table->timestamps();

            $table->index(['token', 'is_active']);
            $table->index('email');
            $table->index('expires_at');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('access_shareable_tokens');
    }
};

```

---

## Migration Execution Order

Execute migrations in this exact order:

1. ✅ `create_companies_table`
2. ✅ `create_locations_table`
3. ✅ `create_users_table`
4. ✅ `create_customers_table`
5. ✅ `create_packages_table`
6. ✅ `create_attractions_table`
7. ✅ `create_rooms_table`
8. ✅ `create_add_ons_table`
9. ✅ `create_gift_cards_table`
10. ✅ `create_promos_table`
11. ✅ `create_bookings_table`
12. ✅ `create_booking_attractions_table`
13. ✅ `create_booking_add_ons_table`
14. ✅ `create_package_attractions_table`
15. ✅ `create_package_add_ons_table`
16. ✅ `create_package_gift_cards_table`
17. ✅ `create_package_promos_table`
18. ✅ `create_package_rooms_table`
19. ✅ `create_customer_gift_cards_table`
20. ✅ `create_reservations_table`
21. ✅ `create_payments_table`
22. ✅ `create_attraction_purchases_table`
23. ✅ `create_notifications_table`
24. ✅ `create_activity_logs_table`
25. ✅ `create_password_reset_tokens_table`
26. ✅ `create_sessions_table`
27. ✅ `create_personal_access_tokens_table`

---

## Running Migrations

```bash
# Run all migrations
php artisan migrate

# Run migrations with seed data
php artisan migrate --seed

# Rollback last migration
php artisan migrate:rollback

# Rollback all migrations
php artisan migrate:reset

# Rollback all and re-migrate
php artisan migrate:refresh

# Rollback all, re-migrate, and seed
php artisan migrate:refresh --seed

# Check migration status
php artisan migrate:status
```

---

## Notes

1. **Foreign Key Constraints**: All foreign keys use `constrained()` which automatically references the correct table based on naming convention.

2. **Cascade Deletes**: Most relationships use `onDelete('cascade')` to automatically delete child records when parent is deleted.

3. **Set Null**: Some foreign keys use `onDelete('set null')` to preserve historical data (e.g., bookings keep record even if user is deleted).

4. **Indexes**: Added indexes on frequently queried columns and foreign keys for performance.

5. **Unique Constraints**: Pivot tables have unique constraints to prevent duplicate relationships.

6. **JSON Columns**: Uses `json()` type for flexible data storage (availability, metadata, assigned_areas).

7. **Soft Deletes**: Can be added by including `$table->softDeletes()` if needed for any table.

8. **Timestamps**: All tables include `created_at` and `updated_at` via `timestamps()`.

---

## Environment Setup

Make sure your `.env` file is configured:

```env
DB_CONNECTION=mysql
DB_HOST=127.0.0.1
DB_PORT=3306
DB_DATABASE=booking_system
DB_USERNAME=root
DB_PASSWORD=your_password
```

For PostgreSQL:
```env
DB_CONNECTION=pgsql
DB_HOST=127.0.0.1
DB_PORT=5432
DB_DATABASE=booking_system
DB_USERNAME=postgres
DB_PASSWORD=your_password
```
