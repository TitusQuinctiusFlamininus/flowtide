using System.Reflection;
using System.Runtime.Loader;
using System.Text.Json;

const string NUnitTestAttribute = "NUnit.Framework.TestAttribute";
const string NUnitTestCaseAttribute = "NUnit.Framework.TestCaseAttribute";
const string NUnitSetUpAttribute = "NUnit.Framework.SetUpAttribute";
const string NUnitTearDownAttribute = "NUnit.Framework.TearDownAttribute";
const string NUnitOneTimeSetUpAttribute = "NUnit.Framework.OneTimeSetUpAttribute";
const string NUnitOneTimeTearDownAttribute = "NUnit.Framework.OneTimeTearDownAttribute";
const string UnityTestAttribute = "UnityEngine.TestTools.UnityTestAttribute";

if (args.Length < 2)
{
    Console.WriteLine("FLOWTIDE_JSON:{\"passed\":0,\"failed\":0,\"total\":0,\"discoveredRegular\":0,\"discoveredUnity\":0,\"executedRegular\":0,\"error\":\"Expected projectRoot and testAssemblyPath arguments\"}");
    return;
}

var projectRoot = args[0];
var testAssemblyPath = args[1];
var resolverDirs = BuildResolverDirectories(projectRoot, testAssemblyPath);
RegisterResolver(resolverDirs);

var output = new RunnerOutput();

try
{
    var asm = Assembly.LoadFrom(testAssemblyPath);

    foreach (var type in GetLoadableTypes(asm))
    {
        if (type is null || !type.IsClass || type.IsAbstract)
        {
            continue;
        }

        var methods = type.GetMethods(BindingFlags.Public | BindingFlags.NonPublic | BindingFlags.Instance);

        var oneTimeSetups = methods.Where(m => HasAttr(m, NUnitOneTimeSetUpAttribute)).ToArray();
        var oneTimeTearDowns = methods.Where(m => HasAttr(m, NUnitOneTimeTearDownAttribute)).ToArray();
        var setups = methods.Where(m => HasAttr(m, NUnitSetUpAttribute)).ToArray();
        var tearDowns = methods.Where(m => HasAttr(m, NUnitTearDownAttribute)).ToArray();

        var cases = new List<TestCase>();

        foreach (var method in methods)
        {
            var isUnity = HasAttr(method, UnityTestAttribute);
            var hasTest = HasAttr(method, NUnitTestAttribute);
            var testCaseAttrs = method.CustomAttributes
                .Where(a => string.Equals(a.AttributeType.FullName, NUnitTestCaseAttribute, StringComparison.Ordinal))
                .ToList();

            if (isUnity)
            {
                output.DiscoveredUnity += Math.Max(1, testCaseAttrs.Count);
                continue;
            }

            if (!hasTest && testCaseAttrs.Count == 0)
            {
                continue;
            }

            if (testCaseAttrs.Count > 0)
            {
                foreach (var attr in testCaseAttrs)
                {
                    output.DiscoveredRegular += 1;
                    cases.Add(new TestCase
                    {
                        Method = method,
                        Args = attr.ConstructorArguments.Select(ConvertTypedArg).ToArray(),
                        Name = $"{type.FullName}.{method.Name}(TestCase)"
                    });
                }

                continue;
            }

            output.DiscoveredRegular += 1;
            if (method.GetParameters().Length == 0)
            {
                cases.Add(new TestCase
                {
                    Method = method,
                    Args = Array.Empty<object?>(),
                    Name = $"{type.FullName}.{method.Name}"
                });
            }
        }

        if (cases.Count == 0)
        {
            continue;
        }

        object? fixture;
        try
        {
            fixture = Activator.CreateInstance(type, nonPublic: true);
        }
        catch (Exception ex)
        {
            output.Failed += cases.Count;
            output.Failures.Add($"{type.FullName} fixture initialization failed: {Unwrap(ex).Message}");
            continue;
        }

        if (fixture is null)
        {
            output.Failed += cases.Count;
            output.Failures.Add($"{type.FullName} fixture initialization failed: instance is null");
            continue;
        }

        try
        {
            foreach (var setup in oneTimeSetups)
            {
                InvokeNoArgs(setup, fixture);
            }

            foreach (var testCase in cases)
            {
                output.ExecutedRegular += 1;
                var passed = true;

                try
                {
                    foreach (var setup in setups)
                    {
                        InvokeNoArgs(setup, fixture);
                    }

                    InvokeTestCase(testCase.Method, fixture, testCase.Args);
                }
                catch (Exception ex)
                {
                    passed = false;
                    output.Failures.Add($"{testCase.Name}: {Unwrap(ex).Message}");
                }
                finally
                {
                    foreach (var tearDown in tearDowns)
                    {
                        try
                        {
                            InvokeNoArgs(tearDown, fixture);
                        }
                        catch (Exception ex)
                        {
                            passed = false;
                            output.Failures.Add($"{type.FullName}.{tearDown.Name}: {Unwrap(ex).Message}");
                        }
                    }
                }

                if (passed)
                {
                    output.Passed += 1;
                }
                else
                {
                    output.Failed += 1;
                }
            }
        }
        finally
        {
            foreach (var teardown in oneTimeTearDowns)
            {
                try
                {
                    InvokeNoArgs(teardown, fixture);
                }
                catch (Exception ex)
                {
                    output.Failures.Add($"{type.FullName}.{teardown.Name}: {Unwrap(ex).Message}");
                }
            }
        }
    }
}
catch (Exception ex)
{
    output.Error = Unwrap(ex).ToString();
}

output.Total = output.Passed + output.Failed;
var json = JsonSerializer.Serialize(output, new JsonSerializerOptions { PropertyNamingPolicy = JsonNamingPolicy.CamelCase });
Console.WriteLine($"FLOWTIDE_JSON:{json}");

static Exception Unwrap(Exception ex)
{
    if (ex is TargetInvocationException tie && tie.InnerException is not null)
    {
        return tie.InnerException;
    }

    return ex;
}

static object? ConvertTypedArg(CustomAttributeTypedArgument arg)
{
    if (arg.Value is IReadOnlyCollection<CustomAttributeTypedArgument> list)
    {
        return list.Select(ConvertTypedArg).ToArray();
    }

    return arg.Value;
}

static IEnumerable<string> BuildResolverDirectories(string projectRoot, string testAssemblyPath)
{
    var dirs = new List<string>();
    var assemblyDir = Path.GetDirectoryName(testAssemblyPath);
    if (!string.IsNullOrWhiteSpace(assemblyDir) && Directory.Exists(assemblyDir))
    {
        dirs.Add(assemblyDir);
    }

    var scriptAssemblies = Path.Combine(projectRoot, "Library", "ScriptAssemblies");
    if (Directory.Exists(scriptAssemblies))
    {
        dirs.Add(scriptAssemblies);
    }

    var packageCache = Path.Combine(projectRoot, "Library", "PackageCache");
    if (Directory.Exists(packageCache))
    {
        try
        {
            foreach (var nunitDir in Directory.GetDirectories(packageCache, "com.unity.ext.nunit@*", SearchOption.TopDirectoryOnly))
            {
                var net40 = Path.Combine(nunitDir, "net40");
                var custom = Path.Combine(net40, "unity-custom");
                if (Directory.Exists(net40)) dirs.Add(net40);
                if (Directory.Exists(custom)) dirs.Add(custom);
            }
        }
        catch
        {
            // ignore resolver directory scanning issues
        }
    }

    return dirs.Distinct(StringComparer.OrdinalIgnoreCase);
}

static void RegisterResolver(IEnumerable<string> resolverDirs)
{
    var dirs = resolverDirs.ToArray();

    AssemblyLoadContext.Default.Resolving += (_, assemblyName) =>
    {
        var candidates = new[]
        {
            $"{assemblyName.Name}.dll",
            $"{assemblyName.Name}.exe"
        };

        foreach (var dir in dirs)
        {
            foreach (var candidate in candidates)
            {
                var path = Path.Combine(dir, candidate);
                if (File.Exists(path))
                {
                    try
                    {
                        return AssemblyLoadContext.Default.LoadFromAssemblyPath(path);
                    }
                    catch
                    {
                        // continue probing
                    }
                }
            }
        }

        return null;
    };
}

static bool HasAttr(MethodInfo method, string fullName)
{
    return method.CustomAttributes.Any(a => string.Equals(a.AttributeType.FullName, fullName, StringComparison.Ordinal));
}

static IEnumerable<Type?> GetLoadableTypes(Assembly asm)
{
    try
    {
        return asm.GetTypes();
    }
    catch (ReflectionTypeLoadException ex)
    {
        return ex.Types;
    }
}

static void InvokeNoArgs(MethodInfo method, object target)
{
    var result = method.Invoke(target, null);
    if (result is Task task)
    {
        task.GetAwaiter().GetResult();
    }
}

static void InvokeTestCase(MethodInfo method, object target, object?[] args)
{
    var result = method.Invoke(target, args);
    if (result is Task task)
    {
        task.GetAwaiter().GetResult();
    }
}

file sealed class RunnerOutput
{
    public int Passed { get; set; }
    public int Failed { get; set; }
    public int Total { get; set; }
    public int DiscoveredRegular { get; set; }
    public int DiscoveredUnity { get; set; }
    public int ExecutedRegular { get; set; }
    public string? Error { get; set; }
    public List<string> Failures { get; } = new();
}

file sealed class TestCase
{
    public required MethodInfo Method { get; init; }
    public required object?[] Args { get; init; }
    public required string Name { get; init; }
}
